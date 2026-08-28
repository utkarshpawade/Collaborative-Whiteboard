# AWS deployment

Free-tier deployment of the whole stack: one EC2 instance running the frontend,
both backends and Caddy, with Postgres on RDS and CloudFront in front for TLS.

```
Browser
   |  https + wss
[ CloudFront ]  dxxxxxxxx.cloudfront.net       TLS, 1 TB/mo free, perpetual
   |  http
[ EC2 t3.micro ]  Elastic IP                   750 hrs/mo free
   |  Caddy :80
   |    /api/*  -> strip /api -> http-backend :3001
   |    /ws*    ->              ws-backend    :8080
   |    /*      ->              frontend      :3000
   |
[ RDS db.t4g.micro ]  Postgres                 750 hrs/mo + 20 GB free
```

Deliberately **not** used: an Application Load Balancer (no free tier, ~$18/mo)
and a custom VPC with a NAT Gateway (~$32/mo). The default VPC is enough.

## Why one domain

Serving the app and the API from a single CloudFront domain means the browser
treats API calls as same-origin, so there are no CORS preflights, and one
distribution covers both `https://` and `wss://`. The cost is that Caddy has to
strip the `/api` prefix, because the REST API mounts its routes at the root.

## Prerequisites

- AWS credentials with permissions for EC2, RDS, ECR, IAM, CloudFront
- Docker running locally (images are built here, not on the instance)
- `aws`, `docker`, `ssh`, `git`, `openssl` on PATH

## Deploy

```bash
cd deploy/aws
export AWS_REGION=ap-south-1        # or wherever you want it

./provision.sh                      # ~15 min, mostly waiting on RDS
./deploy.sh                         # build, push, roll out
```

`provision.sh` is idempotent — re-run it after a failure and it picks up where it
stopped. It writes `.state.env` (gitignored) holding resource IDs, the generated
`JWT_SECRET` and the database password.

To ship a code change afterwards, only `./deploy.sh` is needed.

## Ordering constraint

`NEXT_PUBLIC_HTTP_BACKEND` and `NEXT_PUBLIC_WS_URL` are inlined into the client
bundle by `next build`. The frontend therefore cannot be built until the
CloudFront domain exists, which is why `provision.sh` creates the distribution
and `deploy.sh` passes the domain in as a build argument. Changing the public URL
means rebuilding the frontend image, not restarting a container.

## Scaling limits

`ws-backend` keeps its connections in an in-process `Map` with no shared pub/sub,
so it must stay at exactly one replica. Two instances would put users in the same
room on different processes and they would stop seeing each other's shapes.
Fixing that means adding Redis pub/sub; until then, this deployment is capped at
one WebSocket process.

The instance has 1 GB of RAM for three Node processes, so `user-data.sh` adds 2 GB
of swap and each container is capped at a 256 MB heap.

## Operating

```bash
source .state.env

ssh -i "$KEY_FILE" ec2-user@$PUBLIC_IP

# on the box
cd /opt/excalidraw
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f ws-backend
```

Health checks:

| Check | URL |
| --- | --- |
| Caddy itself | `http://$PUBLIC_IP/_health` |
| REST API | `http://$PUBLIC_IP/api/health` |
| WebSocket server | `http://$PUBLIC_IP/ws/health` |
| Through the CDN | `$PUBLIC_ORIGIN/api/health` |

A brand new distribution takes 5–15 minutes to propagate; until it does, the CDN
URL can 502 while the origin checks already pass.

## Costs after the free tier

Roughly $8/mo for the instance, $12/mo for the database, and CloudFront stays
free below 1 TB. An **Elastic IP is billed hourly when it is not attached to a
running instance**, so stopping the instance to save money still costs a few
dollars a month unless the address is released too.

## Teardown

```bash
./destroy.sh
```

Deletes everything, including the database and every drawing in it, with no final
snapshot. CloudFront must be disabled and fully propagated before it can be
deleted, which is why the script waits ~10 minutes.

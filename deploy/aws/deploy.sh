#!/usr/bin/env bash
# Builds the three images locally, pushes them to ECR, and rolls the stack over
# on the EC2 host. Run provision.sh first.
#
# Images are built here rather than on the instance because a 1 GB t3.micro
# cannot complete a Next.js production build.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
STATE_FILE=".state.env"
[[ -f "$STATE_FILE" ]] || { echo "No $STATE_FILE. Run ./provision.sh first." >&2; exit 1; }
# shellcheck disable=SC1090
source "$STATE_FILE"

AWS="${AWS_CLI:-aws}"
PROFILE_ARG=""
[[ -n "${AWS_PROFILE:-}" ]] && PROFILE_ARG="--profile ${AWS_PROFILE}"
aws_() { $AWS --region "$REGION" $PROFILE_ARG "$@"; }
log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

REPO_ROOT=$(cd ../.. && pwd)
TAG="${IMAGE_TAG:-$(git -C "$REPO_ROOT" rev-parse --short HEAD)}"
SSH_OPTS=(-i "$KEY_FILE" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)

log "Signing in to ECR"
aws_ ecr get-login-password | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# The instance is x86_64; Docker Desktop will happily build arm64 on some hosts
# and the resulting image fails at exec time with a format error.
BUILD=(docker build --platform linux/amd64)

log "Building images ($TAG)"
cd "$REPO_ROOT"

"${BUILD[@]}" -f apps/http-backend/Dockerfile \
  -t "$ECR_REGISTRY/excalidraw-http:$TAG" -t "$ECR_REGISTRY/excalidraw-http:latest" .

"${BUILD[@]}" -f apps/ws-backend/Dockerfile \
  -t "$ECR_REGISTRY/excalidraw-ws:$TAG" -t "$ECR_REGISTRY/excalidraw-ws:latest" .

# NEXT_PUBLIC_* are compiled into the client bundle, so the public URL has to be
# known at build time. This is why CloudFront is created before the first deploy.
"${BUILD[@]}" -f apps/excelidraw-frontend/Dockerfile \
  --build-arg "NEXT_PUBLIC_HTTP_BACKEND=$PUBLIC_ORIGIN/api" \
  --build-arg "NEXT_PUBLIC_WS_URL=wss://$CF_DOMAIN/ws" \
  -t "$ECR_REGISTRY/excalidraw-frontend:$TAG" -t "$ECR_REGISTRY/excalidraw-frontend:latest" .

log "Pushing to ECR"
for repo in excalidraw-http excalidraw-ws excalidraw-frontend; do
  docker push "$ECR_REGISTRY/$repo:$TAG"
  docker push "$ECR_REGISTRY/$repo:latest"
done

cd "$(dirname "${BASH_SOURCE[0]}")"

log "Waiting for the instance bootstrap to finish"
for i in {1..40}; do
  if ssh "${SSH_OPTS[@]}" "ec2-user@$PUBLIC_IP" 'test -f /var/lib/cloud/instance/excalidraw-bootstrap-done' 2>/dev/null; then
    break
  fi
  [[ $i -eq 40 ]] && { echo "Bootstrap did not complete; check /var/log/excalidraw-bootstrap.log" >&2; exit 1; }
  sleep 15
done

log "Shipping configuration"
scp "${SSH_OPTS[@]}" docker-compose.prod.yml Caddyfile "ec2-user@$PUBLIC_IP:/opt/excalidraw/"

# Written over ssh rather than scp so the secrets never touch a local file that
# is not already gitignored.
ssh "${SSH_OPTS[@]}" "ec2-user@$PUBLIC_IP" "cat > /opt/excalidraw/.env && chmod 600 /opt/excalidraw/.env" <<ENV
ECR_REGISTRY=$ECR_REGISTRY
IMAGE_TAG=$TAG
DATABASE_URL=$DATABASE_URL
JWT_SECRET=$JWT_SECRET
PUBLIC_ORIGIN=$PUBLIC_ORIGIN
ENV

log "Rolling out"
ssh "${SSH_OPTS[@]}" "ec2-user@$PUBLIC_IP" bash -s <<REMOTE
set -euo pipefail
cd /opt/excalidraw
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker image prune -f
docker compose -f docker-compose.prod.yml ps
REMOTE

log "Verifying"
sleep 10
echo -n "  origin  /_health   -> "; curl -fsS --max-time 15 "http://$PUBLIC_IP/_health" || echo "FAILED"
echo
echo -n "  origin  /api/health -> "; curl -fsS --max-time 15 "http://$PUBLIC_IP/api/health" || echo "FAILED"
echo
echo -n "  cdn     /api/health -> "; curl -fsS --max-time 30 "$PUBLIC_ORIGIN/api/health" || echo "not ready yet"
echo

cat <<DONE

  Deployed $TAG

  App    $PUBLIC_ORIGIN
  Logs   ssh -i deploy/aws/$KEY_FILE ec2-user@$PUBLIC_IP 'cd /opt/excalidraw && docker compose -f docker-compose.prod.yml logs -f'

  A new CloudFront distribution takes 5-15 minutes to reach every edge. Until
  then the CDN URL may 502 while the origin checks above already pass.

DONE

# Collaborative Whiteboard

A collaborative whiteboard: draw freehand, rectangles and circles on an infinite
canvas and see everyone else's shapes appear live.

## Structure

Turborepo + pnpm workspaces.

| Path                       | What it is                                             |
| -------------------------- | ------------------------------------------------------ |
| `apps/excelidraw-frontend` | Next.js 15 drawing app (landing, auth, boards, canvas) |
| `apps/web`                 | Next.js 15 chat-room demo sharing the same backend     |
| `apps/http-backend`        | Express REST API: auth, rooms, shape history           |
| `apps/ws-backend`          | WebSocket server that broadcasts and persists shapes   |
| `packages/db`              | Prisma schema, migrations and the shared client        |
| `packages/common`          | Zod schemas and types shared by frontend and backends  |
| `packages/backend-common`  | Env/config loading for both backends                   |
| `packages/ui`              | Shared React components                                |

## Requirements

- Node.js 20+
- pnpm 9 (`corepack enable`)
- PostgreSQL 14+ (or Docker)

## Local setup

```bash
pnpm install
```

### 1. Environment

Copy each example file and fill in the values:

```bash
cp packages/db/.env.example              packages/db/.env
cp apps/http-backend/.env.example        apps/http-backend/.env
cp apps/ws-backend/.env.example          apps/ws-backend/.env
cp apps/excelidraw-frontend/.env.example apps/excelidraw-frontend/.env.local
cp apps/web/.env.example                 apps/web/.env.local
```

Generate a JWT secret and put the **same value** in both backend `.env` files —
tokens signed by the API must verify in the WebSocket server:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

| Variable                   | Used by           | Notes                                          |
| -------------------------- | ----------------- | ---------------------------------------------- |
| `DATABASE_URL`             | db, both backends | Postgres connection string                     |
| `JWT_SECRET`               | both backends     | Must match; required in production             |
| `JWT_EXPIRES_IN`           | http-backend      | Token lifetime, default `7d`                   |
| `PORT`                     | both backends     | Defaults 3001 / 8080                           |
| `ALLOWED_ORIGINS`          | http-backend      | Comma separated origins, or `*` in development |
| `NEXT_PUBLIC_HTTP_BACKEND` | frontends         | Inlined at build time                          |
| `NEXT_PUBLIC_WS_URL`       | frontends         | Inlined at build time                          |

### 2. Database

Start Postgres (skip if you already have one):

```bash
docker compose up -d postgres
```

Apply migrations:

```bash
pnpm db:deploy      # or pnpm db:migrate while developing
```

### 3. Run

```bash
pnpm dev
```

- Drawing app: http://localhost:3000
- REST API: http://localhost:3001
- WebSocket: ws://localhost:8080
- Chat demo: whichever port Next picks next

Sign up, create a board, and share its name with someone else to draw together.

## Canvas controls

| Action     | How                                               |
| ---------- | ------------------------------------------------- |
| Draw       | Pencil / rectangle / circle from the top toolbar  |
| Pan        | Hand tool, hold **space**, middle-drag, or scroll |
| Zoom       | **Ctrl/Cmd + scroll**, or the bottom-left buttons |
| Reset view | The maximise button, bottom left                  |

## Useful commands

```bash
pnpm build         # build every app and package
pnpm check-types   # tsc --noEmit everywhere
pnpm lint          # eslint everywhere
pnpm db:studio     # browse the database
```

## Deployment

### Frontend on Vercel

1. New Project → import this repo.
2. Set **Root Directory** to `apps/excelidraw-frontend`. The `vercel.json` there
   already sets the install and build commands for the workspace.
3. Add `NEXT_PUBLIC_HTTP_BACKEND` and `NEXT_PUBLIC_WS_URL` pointing at your
   deployed backends. Use `https://` and `wss://` — a browser on an HTTPS page
   cannot open a plain `ws://` socket.
4. Redeploy after changing them: they are baked in at build time.

### Backends with Docker

Both images build from the repository root:

```bash
docker build -f apps/http-backend/Dockerfile -t excalidraw-http .
docker build -f apps/ws-backend/Dockerfile   -t excalidraw-ws   .
```

Run them with `DATABASE_URL`, `JWT_SECRET`, `PORT` and (for the API)
`ALLOWED_ORIGINS` set. Both expose `GET /health` for platform health checks.

On Railway / Render / Fly, point the service at the matching Dockerfile with the
repository root as build context, and run `pnpm db:deploy` once against the
production database.

### Whole stack locally

```bash
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
docker compose up --build
```

This starts Postgres, applies migrations and runs both backends. Run the
frontend separately with `pnpm dev`.

## API

| Method | Route            | Auth | Purpose                       |
| ------ | ---------------- | ---- | ----------------------------- |
| GET    | `/health`        | no   | Liveness probe                |
| POST   | `/signup`        | no   | Create an account, get a token |
| POST   | `/signin`        | no   | Exchange credentials for a token |
| GET    | `/me`            | yes  | Current user                  |
| POST   | `/room`          | yes  | Create a board                |
| GET    | `/rooms`         | yes  | Boards you created            |
| GET    | `/room/:slug`    | yes  | Look up a board by name       |
| GET    | `/chats/:roomId` | yes  | Shape history, oldest first   |

WebSocket messages are `join_room`, `leave_room` and `chat`, each carrying a
`roomId`; the token goes in `?token=` or an `Authorization: Bearer` header.


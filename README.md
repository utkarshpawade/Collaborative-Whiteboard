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

## Useful commands

```bash
pnpm build         # build every app and package
pnpm check-types   # tsc --noEmit everywhere
pnpm lint          # eslint everywhere
pnpm db:studio     # browse the database
```


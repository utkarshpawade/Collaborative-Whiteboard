# Build context is the repository root:
#   docker build -f apps/http-backend/Dockerfile -t excalidraw-http .
FROM node:22-alpine AS base
# openssl is required by the Prisma query engine on alpine.
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable
WORKDIR /app

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
# turbo builds @repo/db, @repo/common and @repo/backend-common first.
RUN pnpm turbo build --filter=http-backend

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app /app
USER node
EXPOSE 3001
CMD ["node", "apps/http-backend/dist/index.js"]

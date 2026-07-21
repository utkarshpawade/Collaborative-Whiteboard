# Build context is the repository root:
#   docker build -f apps/ws-backend/Dockerfile -t excalidraw-ws .
FROM node:22-alpine AS base
# openssl is required by the Prisma query engine on alpine.
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable
WORKDIR /app

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=ws-backend

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app /app
USER node
EXPOSE 8080
CMD ["node", "apps/ws-backend/dist/index.js"]

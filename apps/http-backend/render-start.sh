#!/bin/sh
# Start command for the Render web service - see `dockerCommand` in render.yaml.
#
# This lives in a file rather than inline in render.yaml because Render splits
# the configured command on whitespace without honouring shell quoting, so an
# inline `sh -c "a && b"` arrives with the quotes still attached and exits 127.
# A two token command (`sh <path>`) has nothing to misparse.
set -e

# Render overrides the image CMD, so do not rely on the Dockerfile's WORKDIR.
cd /app

# Idempotent: applies only migrations the database has not seen, so it is safe
# on every restart and redeploy. Only this service migrates - the WebSocket
# server must not race it.
echo "[render-start] applying database migrations"
packages/db/node_modules/.bin/prisma migrate deploy \
  --schema packages/db/prisma/schema.prisma

# exec so node replaces this shell as PID 1 and receives SIGTERM directly,
# which is what the server's graceful shutdown handler is waiting for.
echo "[render-start] starting http-backend"
exec node apps/http-backend/dist/index.js

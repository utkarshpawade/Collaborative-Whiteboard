import { HTTP_PORT } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";
import { createApp } from "./app";

const app = createApp();

const server = app.listen(HTTP_PORT, () => {
  console.log(`[http-backend] listening on port ${HTTP_PORT}`);
});

function shutdown(signal: string) {
  console.log(`[http-backend] ${signal} received, shutting down`);
  server.close(async () => {
    await prismaClient.$disconnect();
    process.exit(0);
  });

  // Force exit if connections do not drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

import { config as loadEnv } from "dotenv";

// Load a local .env when one exists. In hosted environments the platform
// injects real environment variables and this is a no-op.
loadEnv();

export const JWT_SECRET: string =
  process.env.JWT_SECRET || "dev-only-insecure-secret";

/** Token lifetime, e.g. "7d". */
export const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || "7d";

export const HTTP_PORT: number = Number(
  process.env.PORT || process.env.HTTP_PORT || 3001,
);

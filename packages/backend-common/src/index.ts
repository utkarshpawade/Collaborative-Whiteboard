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

export const WS_PORT: number = Number(
  process.env.PORT || process.env.WS_PORT || 8080,
);

/**
 * Comma separated list of allowed browser origins.
 * Use "*" (the default in development) to allow any origin.
 */
export const ALLOWED_ORIGINS: string[] = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

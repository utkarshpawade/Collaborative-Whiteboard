import { config as loadEnv } from "dotenv";

// Load a local .env when one exists. In hosted environments the platform
// injects real environment variables and this is a no-op.
loadEnv();

const isProduction = process.env.NODE_ENV === "production";

const DEV_JWT_SECRET = "dev-only-insecure-secret";

function requireSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length === 0) {
    if (isProduction) {
      throw new Error(
        "JWT_SECRET is not set. Refusing to start in production with an insecure default.",
      );
    }
    console.warn(
      "[backend-common] JWT_SECRET is not set - falling back to an insecure development secret.",
    );
    return DEV_JWT_SECRET;
  }

  if (isProduction && secret === DEV_JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is set to the development placeholder. Set a strong secret in production.",
    );
  }

  return secret;
}

export const JWT_SECRET: string = requireSecret();

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

export const IS_PRODUCTION: boolean = isProduction;

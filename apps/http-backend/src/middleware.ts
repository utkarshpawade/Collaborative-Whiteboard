import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Reads the bearer token from the Authorization header and attaches the user id
 * to the request. Responds with 401 when the token is missing or invalid.
 */
export function middleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : header.trim();

  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded === "string" || !decoded.userId) {
      res.status(401).json({ message: "Invalid token" });
      return;
    }

    req.userId = String(decoded.userId);
    next();
  } catch {
    // jwt.verify throws on an expired or tampered token - never let that
    // bubble up as an unhandled 500.
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  ALLOWED_ORIGINS,
} from "@repo/backend-common/config";
import {
  CreateUserSchema,
  SigninSchema,
  CreateRoomSchema,
} from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
import { middleware } from "./middleware";

const BCRYPT_ROUNDS = 10;

/**
 * A valid bcrypt hash of a value nobody can guess. Compared against when the
 * email is unknown so signin takes the same time either way.
 */
const DUMMY_PASSWORD_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

/** Turns a zod error into a flat `{ field: message }` object for the client. */
function fieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}) {
  const flat = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(flat).map(([key, messages]) => [key, messages?.[0] ?? "Invalid value"]),
  );
}

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin: ALLOWED_ORIGINS.includes("*") ? true : ALLOWED_ORIGINS,
      credentials: true,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  /* ----------------------------------- auth ---------------------------------- */

  app.post("/signup", async (req, res, next) => {
    const parsedData = CreateUserSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.status(400).json({
        message: "Incorrect inputs",
        errors: fieldErrors(parsedData.error),
      });
      return;
    }

    try {
      const hashedPassword = await bcrypt.hash(parsedData.data.password, BCRYPT_ROUNDS);

      const user = await prismaClient.user.create({
        data: {
          email: parsedData.data.username,
          password: hashedPassword,
          name: parsedData.data.name,
        },
        select: { id: true, email: true, name: true },
      });

      res.status(201).json({ userId: user.id, user, token: signToken(user.id) });
    } catch (e) {
      next(e);
    }
  });

  app.post("/signin", async (req, res, next) => {
    const parsedData = SigninSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.status(400).json({
        message: "Incorrect inputs",
        errors: fieldErrors(parsedData.error),
      });
      return;
    }

    try {
      const user = await prismaClient.user.findUnique({
        where: { email: parsedData.data.username },
      });

      // Always run a comparison so the response time does not reveal whether
      // the account exists.
      const passwordMatches = await bcrypt.compare(
        parsedData.data.password,
        user?.password ?? DUMMY_PASSWORD_HASH,
      );

      if (!user || !passwordMatches) {
        res.status(403).json({ message: "Incorrect email or password" });
        return;
      }

      res.json({
        token: signToken(user.id),
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (e) {
      next(e);
    }
  });

  app.get("/me", middleware, async (req, res, next) => {
    try {
      const user = await prismaClient.user.findUnique({
        where: { id: req.userId },
        select: { id: true, email: true, name: true },
      });

      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      res.json({ user });
    } catch (e) {
      next(e);
    }
  });

  /* ---------------------------------- rooms ---------------------------------- */

  app.post("/room", middleware, async (req, res, next) => {
    const parsedData = CreateRoomSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.status(400).json({
        message: "Incorrect inputs",
        errors: fieldErrors(parsedData.error),
      });
      return;
    }

    try {
      const room = await prismaClient.room.create({
        data: {
          slug: parsedData.data.name,
          adminId: req.userId!,
        },
      });

      res.status(201).json({ roomId: room.id, slug: room.slug });
    } catch (e) {
      next(e);
    }
  });

  app.get("/rooms", middleware, async (req, res, next) => {
    try {
      const rooms = await prismaClient.room.findMany({
        where: { adminId: req.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, slug: true, createdAt: true },
      });

      res.json({ rooms });
    } catch (e) {
      next(e);
    }
  });

  app.get("/room/:slug", middleware, async (req, res, next) => {
    try {
      const room = await prismaClient.room.findUnique({
        where: { slug: req.params.slug },
        select: { id: true, slug: true, createdAt: true },
      });

      if (!room) {
        res.status(404).json({ message: "Room not found" });
        return;
      }

      res.json({ room });
    } catch (e) {
      next(e);
    }
  });

  /* ---------------------------------- chats ---------------------------------- */

  app.get("/chats/:roomId", middleware, async (req, res, next) => {
    const roomId = Number(req.params.roomId);

    try {
      // Ascending so clients replay the room history in the order it was written.
      const messages = await prismaClient.chat.findMany({
        where: { roomId },
        orderBy: { id: "asc" },
      });

      res.json({ messages });
    } catch (e) {
      next(e);
    }
  });

  /* --------------------------------- fallbacks -------------------------------- */

  app.use((_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[http-backend] Unhandled error:", err);
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
}

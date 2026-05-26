import express, { type Express } from "express";
import cors from "cors";
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

  /* ----------------------------------- auth ---------------------------------- */

  app.post("/signup", async (req, res) => {
    const parsedData = CreateUserSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.status(400).json({
        message: "Incorrect inputs",
        errors: fieldErrors(parsedData.error),
      });
      return;
    }

    const user = await prismaClient.user.create({
      data: {
        email: parsedData.data.username,
        password: parsedData.data.password,
        name: parsedData.data.name,
      },
      select: { id: true, email: true, name: true },
    });

    res.status(201).json({ userId: user.id, user, token: signToken(user.id) });
  });

  app.post("/signin", async (req, res) => {
    const parsedData = SigninSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.status(400).json({
        message: "Incorrect inputs",
        errors: fieldErrors(parsedData.error),
      });
      return;
    }

    const user = await prismaClient.user.findFirst({
      where: {
        email: parsedData.data.username,
        password: parsedData.data.password,
      },
    });

    if (!user) {
      res.status(403).json({ message: "Incorrect email or password" });
      return;
    }

    res.json({
      token: signToken(user.id),
      user: { id: user.id, email: user.email, name: user.name },
    });
  });

  app.get("/me", middleware, async (req, res) => {
    const user = await prismaClient.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ user });
  });

  /* ---------------------------------- rooms ---------------------------------- */

  app.post("/room", middleware, async (req, res) => {
    const parsedData = CreateRoomSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.status(400).json({
        message: "Incorrect inputs",
        errors: fieldErrors(parsedData.error),
      });
      return;
    }

    const room = await prismaClient.room.create({
      data: {
        slug: parsedData.data.name,
        adminId: req.userId!,
      },
    });

    res.status(201).json({ roomId: room.id, slug: room.slug });
  });

  app.get("/rooms", middleware, async (req, res) => {
    const rooms = await prismaClient.room.findMany({
      where: { adminId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, slug: true, createdAt: true },
    });

    res.json({ rooms });
  });

  app.get("/room/:slug", middleware, async (req, res) => {
    const room = await prismaClient.room.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, slug: true, createdAt: true },
    });

    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }

    res.json({ room });
  });

  /* ---------------------------------- chats ---------------------------------- */

  app.get("/chats/:roomId", middleware, async (req, res) => {
    const roomId = Number(req.params.roomId);

    // Ascending so clients replay the room history in the order it was written.
    const messages = await prismaClient.chat.findMany({
      where: { roomId },
      orderBy: { id: "asc" },
    });

    res.json({ messages });
  });

  return app;
}

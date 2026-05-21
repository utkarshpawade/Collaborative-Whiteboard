import express from "express";
import jwt from "jsonwebtoken";
import {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  HTTP_PORT,
} from "@repo/backend-common/config";
import {
  CreateUserSchema,
  SigninSchema,
  CreateRoomSchema,
} from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
import { middleware } from "./middleware";

const app = express();

app.use(express.json());

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

app.post("/signup", async (req, res) => {
  const parsedData = CreateUserSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({ message: "Incorrect inputs" });
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
    res.status(400).json({ message: "Incorrect inputs" });
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

app.post("/room", middleware, async (req, res) => {
  const parsedData = CreateRoomSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({ message: "Incorrect inputs" });
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

app.get("/chats/:roomId", middleware, async (req, res) => {
  const roomId = Number(req.params.roomId);

  // Ascending so clients replay the room history in the order it was written.
  const messages = await prismaClient.chat.findMany({
    where: { roomId },
    orderBy: { id: "asc" },
  });

  res.json({ messages });
});

app.listen(HTTP_PORT, () => {
  console.log(`[http-backend] listening on port ${HTTP_PORT}`);
});

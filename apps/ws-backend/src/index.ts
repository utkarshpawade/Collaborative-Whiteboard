import { WebSocket, WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET, WS_PORT } from "@repo/backend-common/config";
import { ClientMessageSchema } from "@repo/common/types";
import { prismaClient } from "@repo/db/client";

interface Connection {
  ws: WebSocket;
  userId: string;
  rooms: Set<string>;
}

const connections = new Map<WebSocket, Connection>();

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded === "string" || !decoded.userId) {
      return null;
    }

    return String(decoded.userId);
  } catch {
    return null;
  }
}

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function extractToken(url: string | undefined): string {
  if (!url) return "";
  const queryString = url.split("?")[1];
  if (!queryString) return "";
  return new URLSearchParams(queryString).get("token") ?? "";
}

const wss = new WebSocketServer({ port: WS_PORT });

wss.on("connection", (ws, request) => {
  const userId = checkUser(extractToken(request.url));

  if (!userId) {
    // 1008 = policy violation.
    ws.close(1008, "Unauthorized");
    return;
  }

  const connection: Connection = {
    ws,
    userId,
    rooms: new Set(),
  };
  connections.set(ws, connection);

  ws.on("message", async (data) => {
    let raw: unknown;
    try {
      raw = JSON.parse(data.toString());
    } catch {
      send(ws, { type: "error", message: "Malformed JSON" });
      return;
    }

    const parsed = ClientMessageSchema.safeParse(raw);
    if (!parsed.success) {
      send(ws, { type: "error", message: "Unsupported message" });
      return;
    }

    const message = parsed.data;
    const roomId = String(message.roomId);

    if (message.type === "join_room") {
      connection.rooms.add(roomId);
      send(ws, { type: "joined_room", roomId });
      return;
    }

    if (message.type === "leave_room") {
      connection.rooms.delete(roomId);
      return;
    }

    if (message.type === "chat") {
      // Only members of the room may post to it.
      if (!connection.rooms.has(roomId)) {
        send(ws, { type: "error", message: "Join the room before sending" });
        return;
      }

      const numericRoomId = Number(roomId);
      if (!Number.isInteger(numericRoomId)) {
        send(ws, { type: "error", message: "Invalid room id" });
        return;
      }

      try {
        await prismaClient.chat.create({
          data: {
            roomId: numericRoomId,
            message: message.message,
            userId: connection.userId,
          },
        });
      } catch (e) {
        console.error("[ws-backend] failed to persist chat:", e);
        send(ws, { type: "error", message: "Could not save your drawing" });
        return;
      }

      for (const [peerWs, peer] of connections) {
        if (peer.rooms.has(roomId)) {
          send(peerWs, {
            type: "chat",
            message: message.message,
            roomId,
            userId: connection.userId,
          });
        }
      }
    }
  });

  const cleanup = () => {
    connections.delete(ws);
  };

  ws.on("close", cleanup);
  ws.on("error", (err) => {
    console.error("[ws-backend] socket error:", err);
    cleanup();
  });
});

console.log(`[ws-backend] listening on port ${WS_PORT}`);

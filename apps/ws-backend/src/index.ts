import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET, WS_PORT } from "@repo/backend-common/config";
import { ClientMessageSchema } from "@repo/common/types";
import { prismaClient } from "@repo/db/client";

interface Connection {
  ws: WebSocket;
  userId: string;
  rooms: Set<string>;
  isAlive: boolean;
}

const connections = new Map<WebSocket, Connection>();

const HEARTBEAT_INTERVAL_MS = 30_000;

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

/** Accepts the token from `?token=` or an `Authorization: Bearer` header. */
function extractToken(url: string | undefined, authHeader?: string): string {
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  if (!url) return "";
  const queryString = url.split("?")[1];
  if (!queryString) return "";
  return new URLSearchParams(queryString).get("token") ?? "";
}

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", connections: connections.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, request) => {
  const token = extractToken(request.url, request.headers.authorization);
  const userId = checkUser(token);

  if (!userId) {
    // 1008 = policy violation.
    ws.close(1008, "Unauthorized");
    return;
  }

  const connection: Connection = {
    ws,
    userId,
    rooms: new Set(),
    isAlive: true,
  };
  connections.set(ws, connection);

  ws.on("pong", () => {
    connection.isAlive = true;
  });

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

      // The sender already rendered this locally, so echoing it back would
      // duplicate the shape on their canvas.
      for (const [peerWs, peer] of connections) {
        if (peerWs !== ws && peer.rooms.has(roomId)) {
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

// Drop connections that stopped responding so `connections` cannot grow forever.
const heartbeat = setInterval(() => {
  for (const [ws, connection] of connections) {
    if (!connection.isAlive) {
      ws.terminate();
      connections.delete(ws);
      continue;
    }
    connection.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL_MS);

server.listen(WS_PORT, () => {
  console.log(`[ws-backend] listening on port ${WS_PORT}`);
});

function shutdown(signal: string) {
  console.log(`[ws-backend] ${signal} received, shutting down`);
  clearInterval(heartbeat);
  for (const ws of connections.keys()) {
    ws.close(1001, "Server shutting down");
  }
  wss.close(() => {
    server.close(async () => {
      await prismaClient.$disconnect();
      process.exit(0);
    });
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

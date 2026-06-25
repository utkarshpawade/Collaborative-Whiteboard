"use client";

import { useEffect, useState } from "react";
import { WS_URL } from "@/config";
import { getToken } from "@/lib/auth";
import { Canvas } from "./Canvas";

export function RoomCanvas({ roomId }: { roomId: string }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join_room", roomId }));
      setSocket(ws);
    };

    return () => {
      ws.onopen = null;
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close(1000, "Leaving room");
      }
    };
  }, [roomId]);

  if (!socket) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f] px-4 text-center text-white/70">
        Connecting to the board...
      </div>
    );
  }

  return <Canvas roomId={roomId} socket={socket} />;
}

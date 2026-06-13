import { useEffect, useState } from "react";
import { WS_URL } from "../app/config";
import { getToken } from "../lib/auth";

export function useSocket() {
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<WebSocket>();

  useEffect(() => {
    const token = getToken();

    if (!token) {
      setLoading(false);
      return;
    }

    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

    ws.onopen = () => {
      setLoading(false);
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
  }, []);

  return { socket, loading };
}

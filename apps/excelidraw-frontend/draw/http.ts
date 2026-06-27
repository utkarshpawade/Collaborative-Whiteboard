import { type Shape } from "@repo/common/types";
import { api } from "@/lib/api";

/** Loads the shape history for a room, oldest first. */
export async function getExistingShapes(roomId: string): Promise<Shape[]> {
  const res = await api.get(`/chats/${encodeURIComponent(roomId)}`);
  const messages: { message: string }[] = res.data.messages ?? [];

  return messages.map((row) => JSON.parse(row.message).shape as Shape);
}

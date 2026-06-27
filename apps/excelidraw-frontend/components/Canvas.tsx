"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Circle, Pencil, RectangleHorizontalIcon } from "lucide-react";
import { IconButton } from "./IconButton";
import { Game, type Tool } from "@/draw/Game";

export type { Tool };

const TOOLS: { tool: Tool; label: string; icon: ReactNode }[] = [
  { tool: "pencil", label: "Pencil", icon: <Pencil className="h-5 w-5" /> },
  {
    tool: "rect",
    label: "Rectangle",
    icon: <RectangleHorizontalIcon className="h-5 w-5" />,
  },
  { tool: "circle", label: "Circle", icon: <Circle className="h-5 w-5" /> },
];

export function Canvas({ roomId, socket }: { socket: WebSocket; roomId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>("pencil");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new Game(canvas, roomId, socket);
    gameRef.current = game;

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, [roomId, socket]);

  useEffect(() => {
    gameRef.current?.setTool(selectedTool);
  }, [selectedTool]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0f0f0f]">
      {/* Sized by CSS; the canvas backing store is kept in sync by Game. */}
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />

      <div className="fixed left-1/2 top-4 flex -translate-x-1/2 gap-1 rounded-xl border border-white/10 bg-black/70 p-1 backdrop-blur">
        {TOOLS.map(({ tool, label, icon }) => (
          <IconButton
            key={tool}
            label={label}
            icon={icon}
            activated={selectedTool === tool}
            onClick={() => setSelectedTool(tool)}
          />
        ))}
      </div>
    </div>
  );
}

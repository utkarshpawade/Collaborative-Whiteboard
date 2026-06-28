"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Circle,
  Hand,
  Maximize,
  Pencil,
  RectangleHorizontalIcon,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { IconButton } from "./IconButton";
import { Game, type Camera, type Tool } from "@/draw/Game";

export type { Tool };

const TOOLS: { tool: Tool; label: string; icon: ReactNode }[] = [
  { tool: "pencil", label: "Pencil", icon: <Pencil className="h-5 w-5" /> },
  {
    tool: "rect",
    label: "Rectangle",
    icon: <RectangleHorizontalIcon className="h-5 w-5" />,
  },
  { tool: "circle", label: "Circle", icon: <Circle className="h-5 w-5" /> },
  { tool: "hand", label: "Pan (or hold space)", icon: <Hand className="h-5 w-5" /> },
];

export function Canvas({ roomId, socket }: { socket: WebSocket; roomId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>("pencil");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new Game(canvas, roomId, socket);
    gameRef.current = game;
    game.onCamera((camera: Camera) => setZoom(camera.scale));

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

      <div className="fixed bottom-4 left-4 flex items-center gap-1 rounded-xl border border-white/10 bg-black/70 p-1 backdrop-blur">
        <IconButton
          label="Zoom out"
          icon={<ZoomOut className="h-5 w-5" />}
          activated={false}
          onClick={() => gameRef.current?.zoomBy(1 / 1.2)}
        />
        <span className="min-w-14 text-center text-sm tabular-nums text-white/80">
          {Math.round(zoom * 100)}%
        </span>
        <IconButton
          label="Zoom in"
          icon={<ZoomIn className="h-5 w-5" />}
          activated={false}
          onClick={() => gameRef.current?.zoomBy(1.2)}
        />
        <IconButton
          label="Reset view"
          icon={<Maximize className="h-5 w-5" />}
          activated={false}
          onClick={() => gameRef.current?.resetView()}
        />
      </div>

      <p className="pointer-events-none fixed bottom-4 right-4 hidden text-xs text-white/40 sm:block">
        Scroll to pan · Ctrl/Cmd + scroll to zoom · Hold space to drag
      </p>
    </div>
  );
}

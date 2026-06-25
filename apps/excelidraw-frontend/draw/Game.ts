import { type Point, type Shape } from "@repo/common/types";

export type Tool = "circle" | "rect";

const STROKE = "#ffffff";
const BACKGROUND = "#0f0f0f";

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private roomId: string;
  private socket: WebSocket;

  private existingShapes: Shape[] = [];
  private selectedTool: Tool = "rect";

  /** Set while the pointer is down and a shape is being drawn. */
  private drawing = false;
  private startWorld: Point = { x: 0, y: 0 };
  private currentWorld: Point = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context is not available in this browser");
    }
    this.ctx = ctx;
    this.roomId = roomId;
    this.socket = socket;

    this.resize();
    this.initHandlers();
    this.initMouseHandlers();
  }

  /* ------------------------------- public API ------------------------------ */

  setTool(tool: Tool) {
    this.selectedTool = tool;
  }

  destroy() {
    this.canvas.removeEventListener("pointerdown", this.pointerDownHandler);
    this.canvas.removeEventListener("pointermove", this.pointerMoveHandler);
    this.canvas.removeEventListener("pointerup", this.pointerUpHandler);

    // Do not close the socket here - it is owned by the React component.
    if (this.socket.onmessage) {
      this.socket.onmessage = null;
    }
  }

  /* --------------------------------- setup --------------------------------- */

  private initHandlers() {
    this.socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type !== "chat" || !payload.message) return;

      const shape = JSON.parse(payload.message).shape as Shape;
      this.existingShapes.push(shape);
      this.render();
    };
  }

  private initMouseHandlers() {
    this.canvas.addEventListener("pointerdown", this.pointerDownHandler);
    this.canvas.addEventListener("pointermove", this.pointerMoveHandler);
    this.canvas.addEventListener("pointerup", this.pointerUpHandler);
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width));
    this.canvas.height = Math.max(1, Math.round(rect.height));
    this.render();
  }

  /* ------------------------------- coordinates ------------------------------ */

  private toWorld(e: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /* --------------------------------- input --------------------------------- */

  private pointerDownHandler = (e: PointerEvent) => {
    if (e.button !== 0) return;

    this.canvas.setPointerCapture(e.pointerId);

    this.drawing = true;
    this.startWorld = this.toWorld(e);
    this.currentWorld = this.startWorld;
  };

  private pointerMoveHandler = (e: PointerEvent) => {
    if (!this.drawing) return;

    this.currentWorld = this.toWorld(e);
    this.render();
  };

  private pointerUpHandler = (e: PointerEvent) => {
    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId);
    }

    if (!this.drawing) return;
    this.drawing = false;

    const shape = this.buildShape();

    if (!shape) {
      this.render();
      return;
    }

    this.existingShapes.push(shape);
    this.render();
    this.publish(shape);
  };

  /* --------------------------------- shapes -------------------------------- */

  private buildShape(): Shape | null {
    const width = this.currentWorld.x - this.startWorld.x;
    const height = this.currentWorld.y - this.startWorld.y;

    if (this.selectedTool === "rect") {
      if (Math.abs(width) < 1 && Math.abs(height) < 1) return null;
      // Normalise so dragging up/left still produces a positive-size rect.
      return {
        type: "rect",
        x: Math.min(this.startWorld.x, this.currentWorld.x),
        y: Math.min(this.startWorld.y, this.currentWorld.y),
        width: Math.abs(width),
        height: Math.abs(height),
      };
    }

    if (this.selectedTool === "circle") {
      const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
      if (radius < 1) return null;
      return {
        type: "circle",
        centerX: this.startWorld.x + width / 2,
        centerY: this.startWorld.y + height / 2,
        radius,
      };
    }

    return null;
  }

  private publish(shape: Shape) {
    if (this.socket.readyState !== WebSocket.OPEN) return;

    this.socket.send(
      JSON.stringify({
        type: "chat",
        roomId: this.roomId,
        message: JSON.stringify({ shape }),
      }),
    );
  }

  /* -------------------------------- rendering ------------------------------- */

  private render() {
    this.ctx.fillStyle = BACKGROUND;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = STROKE;
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    for (const shape of this.existingShapes) {
      this.drawShape(shape);
    }

    // Live preview of the shape currently being drawn.
    if (this.drawing) {
      const preview = this.buildPreviewShape();
      if (preview) this.drawShape(preview);
    }
  }

  private buildPreviewShape(): Shape | null {
    const width = this.currentWorld.x - this.startWorld.x;
    const height = this.currentWorld.y - this.startWorld.y;

    if (this.selectedTool === "rect") {
      return {
        type: "rect",
        x: Math.min(this.startWorld.x, this.currentWorld.x),
        y: Math.min(this.startWorld.y, this.currentWorld.y),
        width: Math.abs(width),
        height: Math.abs(height),
      };
    }

    if (this.selectedTool === "circle") {
      return {
        type: "circle",
        centerX: this.startWorld.x + width / 2,
        centerY: this.startWorld.y + height / 2,
        radius: Math.max(Math.abs(width), Math.abs(height)) / 2,
      };
    }

    return null;
  }

  private drawShape(shape: Shape) {
    if (shape.type === "rect") {
      this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      return;
    }

    if (shape.type === "circle") {
      this.ctx.beginPath();
      this.ctx.arc(shape.centerX, shape.centerY, Math.abs(shape.radius), 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.closePath();
    }
  }
}

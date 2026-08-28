import { describe, it, expect, vi } from "vitest";
import { paintHello2d, paintMask } from "@/lib/appearance-hello-canvas";

describe("paintMask", () => {
  it("returns the bitmap when 2d context is missing", () => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () => null;
    const bitmap = paintMask(8, 8, 8, 8, 4);
    expect(bitmap.width).toBe(8);
    HTMLCanvasElement.prototype.getContext = native;
  });

  it("draws the hello glyph when a 2d context exists", () => {
    const fillText = vi.fn();
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () =>
      ({
        setTransform: vi.fn(),
        clearRect: vi.fn(),
        fillText,
        fillStyle: "",
        font: "",
        textAlign: "",
        textBaseline: "",
      }) as unknown as CanvasRenderingContext2D;
    paintMask(8, 8, 8, 8, 4);
    expect(fillText).toHaveBeenCalled();
    HTMLCanvasElement.prototype.getContext = native;
  });
});

describe("paintHello2d", () => {
  it("returns when 2d context is missing", () => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () => null;
    const canvas = document.createElement("canvas");
    const lab = document.createElement("div");
    paintHello2d(canvas, lab);
    HTMLCanvasElement.prototype.getContext = native;
  });

  it("paints a dark field", () => {
    const fillRect = vi.fn();
    const fillText = vi.fn();
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () =>
      ({
        setTransform: vi.fn(),
        clearRect: vi.fn(),
        fillRect,
        fillText,
        fillStyle: "",
        font: "",
        textAlign: "",
        textBaseline: "",
      }) as unknown as CanvasRenderingContext2D;
    const canvas = document.createElement("canvas");
    const lab = document.createElement("div");
    lab.dataset.resolved = "dark";
    Object.defineProperty(lab, "clientWidth", { value: 100 });
    Object.defineProperty(lab, "clientHeight", { value: 80 });
    paintHello2d(canvas, lab);
    expect(fillRect).toHaveBeenCalled();
    expect(fillText).toHaveBeenCalled();
    HTMLCanvasElement.prototype.getContext = native;
  });

  it("paints a light field", () => {
    const fillRect = vi.fn();
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () =>
      ({
        setTransform: vi.fn(),
        clearRect: vi.fn(),
        fillRect,
        fillText: vi.fn(),
        fillStyle: "",
        font: "",
        textAlign: "",
        textBaseline: "",
      }) as unknown as CanvasRenderingContext2D;
    const canvas = document.createElement("canvas");
    const lab = document.createElement("div");
    lab.dataset.resolved = "light";
    lab.dataset.ultra = "on";
    Object.defineProperty(lab, "clientWidth", { value: 100 });
    Object.defineProperty(lab, "clientHeight", { value: 80 });
    paintHello2d(canvas, lab);
    expect(fillRect).toHaveBeenCalled();
    HTMLCanvasElement.prototype.getContext = native;
  });
});

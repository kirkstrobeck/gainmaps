import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/appearance-hello-canvas", () => ({
  paintHello2d: vi.fn(),
  helloCenterY: vi.fn(() => 0),
  readState: vi.fn(() => ({ mode: "dark", ultra: "on", intensity: 50 })),
  syncCanvasSize: vi.fn(() => false),
}));

vi.mock("@/lib/appearance-hello-pipeline", () => ({
  createHelloPipeline: vi.fn(),
}));

import { startAppearanceHello } from "@/lib/appearance-hello";

describe("startAppearanceHello (2D path)", () => {
  beforeEach(() => {
    // Return 0 so control.raf2d stays falsy — lets us hit the pending guard
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts a 2D session when WebGPU is unavailable", () => {
    const canvas = document.createElement("canvas");
    const lab = document.createElement("div");
    const session = startAppearanceHello(canvas, lab);
    expect(session).toHaveProperty("poke");
    expect(session).toHaveProperty("stop");
    session.stop();
  });

  it("stop() cancels a running 2D rAF loop", () => {
    vi.stubGlobal("requestAnimationFrame", () => 7);
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const canvas = document.createElement("canvas");
    const lab = document.createElement("div");
    const session = startAppearanceHello(canvas, lab);
    session.stop();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it("poke() is a no-op while boot is already pending", () => {
    // requestAnimationFrame returns 0 so raf2d is falsy after start2d
    const canvas = document.createElement("canvas");
    const lab = document.createElement("div");
    const session = startAppearanceHello(canvas, lab);
    // control.pending is true until the bootGpu microtask settles
    // A second poke() synchronously reaches the pending guard
    session.poke();
    session.stop();
  });
});

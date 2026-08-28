import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { startAppearanceHello } from "@/lib/appearance-hello";
import { installGpu, stubGpuGlobals } from "@/test/helpers/gpu";

function labAndCanvas(): { lab: HTMLElement; canvas: HTMLCanvasElement } {
  const lab = document.createElement("div");
  Object.defineProperty(lab, "clientWidth", { value: 200, configurable: true });
  Object.defineProperty(lab, "clientHeight", { value: 100, configurable: true });
  const canvas = document.createElement("canvas");
  return { lab, canvas };
}

describe("startAppearanceHello", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      return window.setTimeout(() => cb(0), 16);
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  });

  it("falls back to 2d when WebGPU is missing", async () => {
    stubGpuGlobals();
    Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true });
    const { lab, canvas } = labAndCanvas();
    const session = startAppearanceHello(canvas, lab);
    await Promise.resolve();
    session.poke();
    session.stop();
  });

  it("falls back to 2d when the adapter is missing", async () => {
    const gpu = installGpu({ adapter: false });
    const { lab, canvas } = labAndCanvas();
    const session = startAppearanceHello(canvas, lab);
    await Promise.resolve();
    await Promise.resolve();
    session.stop();
    gpu.restore();
  });

  it("falls back to 2d when the webgpu context is missing", async () => {
    const gpu = installGpu({ context: false });
    const { lab, canvas } = labAndCanvas();
    const session = startAppearanceHello(canvas, lab);
    await Promise.resolve();
    await Promise.resolve();
    session.stop();
    gpu.restore();
  });

  it("runs a GPU frame and ignores extra pokes while running", async () => {
    const gpu = installGpu();
    const { lab, canvas } = labAndCanvas();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const session = startAppearanceHello(canvas, lab);
    await Promise.resolve();
    await Promise.resolve();
    expect(lab.dataset.helloSurface).toBe("gpu");
    session.poke();
    if (frames[0]) frames[0](0);
    session.stop();
    expect(gpu.device.destroy).toHaveBeenCalled();
    gpu.restore();
  });
});

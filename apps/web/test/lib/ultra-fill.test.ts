import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startUltraFill } from "@/lib/ultra-fill";
import { installGpu, stubGpuGlobals } from "@/test/helpers/gpu";

describe("startUltraFill", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks unsupported when navigator.gpu is missing", () => {
    stubGpuGlobals();
    Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true });
    const canvas = document.createElement("canvas");
    const session = startUltraFill(canvas, { intensity: 2 });
    session.poke();
    session.stop();
    return Promise.resolve().then(() => {
      expect(canvas.dataset.ultraFill).toBe("unsupported");
    });
  });

  it("marks unsupported when requestAdapter returns null", async () => {
    const gpu = installGpu({ adapter: false });
    const canvas = document.createElement("canvas");
    startUltraFill(canvas, { intensity: 2 });
    await Promise.resolve();
    await Promise.resolve();
    expect(canvas.dataset.ultraFill).toBe("unsupported");
    gpu.restore();
  });

  it("marks unsupported when the webgpu context is missing", async () => {
    const gpu = installGpu({ context: false });
    const canvas = document.createElement("canvas");
    startUltraFill(canvas, { intensity: 2 });
    await Promise.resolve();
    await Promise.resolve();
    expect(canvas.dataset.ultraFill).toBe("unsupported");
    expect(gpu.device.destroy).toHaveBeenCalled();
    gpu.restore();
  });

  it("paints, pokes, and stops on the success path", async () => {
    const gpu = installGpu();
    const canvas = document.createElement("canvas");
    const session = startUltraFill(canvas, { intensity: 4 });
    await Promise.resolve();
    await Promise.resolve();
    expect(canvas.dataset.ultraFill).toBe("on");
    session.poke();
    expect(gpu.device.queue.submit).toHaveBeenCalled();
    session.stop();
    expect(gpu.device.destroy).toHaveBeenCalled();
    gpu.restore();
  });

  it("destroys the device if stop() races the async boot", async () => {
    const gpu = installGpu();
    const canvas = document.createElement("canvas");
    const session = startUltraFill(canvas, { intensity: 1 });
    session.stop();
    await Promise.resolve();
    await Promise.resolve();
    expect(gpu.device.destroy).toHaveBeenCalled();
    gpu.restore();
  });
});

import { describe, it, expect } from "vitest";
import { createHelloPipeline } from "@/lib/appearance-hello-pipeline";
import { stubGpuGlobals } from "@/test/helpers/gpu";

function fakeDevice() {
  const destroyed: string[] = [];
  return {
    destroyed,
    createShaderModule: () => ({}),
    createRenderPipeline: () => ({ getBindGroupLayout: () => ({}) }),
    createBuffer: () => ({}),
    createSampler: () => ({}),
    createTexture: () => ({
      createView: () => ({}),
      destroy: () => destroyed.push("tex"),
    }),
    queue: {
      writeBuffer: () => undefined,
      copyExternalImageToTexture: () => undefined,
    },
  } as unknown as GPUDevice;
}

describe("createHelloPipeline", () => {
  it("writes uniforms, caches the mask, and destroys textures", () => {
    stubGpuGlobals();
    const device = fakeDevice();
    const pipeline = createHelloPipeline(device);
    pipeline.writeUniforms(10, 10, 1, { r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 });
    const first = pipeline.ensureMask(4, 4, 4, 4, 2);
    const again = pipeline.ensureMask(4, 4, 4, 4, 2);
    expect(again).toBe(first);
    pipeline.ensureMask(8, 8, 8, 8, 3);
    pipeline.destroy();
    pipeline.destroy();
  });

  it("destroy before ensureMask is a no-op (textures null branch)", () => {
    stubGpuGlobals();
    const pipeline = createHelloPipeline(fakeDevice());
    pipeline.destroy(); // textures.current is null/undefined → if branch false
  });
});

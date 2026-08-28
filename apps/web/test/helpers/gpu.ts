import { vi } from "vitest";

export function stubGpuGlobals(): void {
  vi.stubGlobal("GPUTextureUsage", {
    RENDER_ATTACHMENT: 16,
    TEXTURE_BINDING: 4,
    COPY_DST: 2,
  });
  vi.stubGlobal("GPUBufferUsage", { UNIFORM: 64, COPY_DST: 8 });
}

export type GpuHarness = {
  device: {
    destroy: ReturnType<typeof vi.fn>;
    queue: {
      submit: ReturnType<typeof vi.fn>;
      writeBuffer: ReturnType<typeof vi.fn>;
      copyExternalImageToTexture: ReturnType<typeof vi.fn>;
    };
  };
  restore: () => void;
};

export function installGpu(options: { adapter?: boolean; context?: boolean } = {}): GpuHarness {
  stubGpuGlobals();
  const adapterOn = options.adapter !== false;
  const contextOn = options.context !== false;
  const destroy = vi.fn();
  const nativeGetContext = HTMLCanvasElement.prototype.getContext;
  const device = {
    destroy,
    queue: {
      submit: vi.fn(),
      writeBuffer: vi.fn(),
      copyExternalImageToTexture: vi.fn(),
    },
    createCommandEncoder: () => ({
      beginRenderPass: () => ({
        end: vi.fn(),
        setPipeline: vi.fn(),
        setBindGroup: vi.fn(),
        draw: vi.fn(),
      }),
      finish: () => ({}),
    }),
    createShaderModule: () => ({}),
    createRenderPipeline: () => ({ getBindGroupLayout: () => ({}) }),
    createBuffer: () => ({}),
    createSampler: () => ({}),
    createBindGroup: () => ({}),
    createTexture: () => ({
      createView: () => ({}),
      destroy: vi.fn(),
    }),
  };

  const gpu = {
    requestAdapter: async () => {
      if (!adapterOn) return null;
      return { requestDevice: async () => device };
    },
  };
  Object.defineProperty(navigator, "gpu", { value: gpu, configurable: true });

  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, attrs?: unknown) {
    if (type === "webgpu") {
      if (!contextOn) return null;
      return {
        configure: vi.fn(),
        getCurrentTexture: () => ({ createView: () => ({}) }),
      } as unknown as RenderingContext;
    }
    return nativeGetContext.call(this, type, attrs as never);
  };

  return {
    device,
    restore: () => {
      HTMLCanvasElement.prototype.getContext = nativeGetContext;
      Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true });
    },
  };
}

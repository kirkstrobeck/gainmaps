// WebGPU type declarations for Ultra fill canvas.
// These types cover only what ultra-fill.ts needs; they do not replace @webgpu/types.

interface GPUCanvasContext {
  configure(descriptor: Record<string, unknown>): void;
  getCurrentTexture(): { createView(): unknown };
}

interface GpuQueue {
  submit(commands: unknown[]): void;
}

interface GpuDevice {
  destroy(): void;
  createCommandEncoder(): {
    beginRenderPass(descriptor: Record<string, unknown>): {
      end(): void;
    };
    finish(): unknown;
  };
  queue: GpuQueue;
}

interface Navigator {
  gpu?: {
    requestAdapter(): Promise<{
      requestDevice(): Promise<GpuDevice>;
    } | null>;
  };
}

declare const GPUTextureUsage: {
  RENDER_ATTACHMENT: number;
};

interface HTMLCanvasElement {
  getContext(contextId: "webgpu"): GPUCanvasContext | null;
}

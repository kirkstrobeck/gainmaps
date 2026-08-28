declare module "*.css";

// Minimal WebGPU type aliases — the full spec is not in the tsconfig lib.
// These mirror the structural types already declared below for GpuDevice.
type GPUDevice = GpuDevice;
type GPURenderPipeline = { getBindGroupLayout(index: number): unknown };
type GPUBuffer = unknown;
type GPUSampler = unknown;

interface GPUCanvasContext {
  configure(descriptor: Record<string, unknown>): void;
  getCurrentTexture(): { createView(): unknown };
}

interface GpuQueue {
  writeBuffer(buffer: unknown, offset: number, data: Float32Array): void;
  copyExternalImageToTexture(
    source: { source: CanvasImageSource },
    destination: { texture: unknown },
    size: [number, number],
  ): void;
  submit(commands: unknown[]): void;
}

interface GpuDevice {
  destroy(): void;
  createShaderModule(descriptor: { code: string }): unknown;
  createRenderPipeline(descriptor: Record<string, unknown>): {
    getBindGroupLayout(index: number): unknown;
  };
  createBuffer(descriptor: Record<string, unknown>): unknown;
  createSampler(descriptor: Record<string, unknown>): unknown;
  createTexture(descriptor: Record<string, unknown>): {
    createView(): unknown;
    destroy(): void;
  };
  createBindGroup(descriptor: Record<string, unknown>): unknown;
  createCommandEncoder(): {
    beginRenderPass(descriptor: Record<string, unknown>): {
      setPipeline(pipeline: unknown): void;
      setBindGroup(index: number, group: unknown): void;
      draw(vertexCount: number): void;
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
  TEXTURE_BINDING: number;
  COPY_DST: number;
};

declare const GPUBufferUsage: { UNIFORM: number; COPY_DST: number };

interface HTMLCanvasElement {
  getContext(contextId: "webgpu"): GPUCanvasContext | null;
}

declare module "heic-decode" {
  type HeicDecodeResult = {
    width: number;
    height: number;
    data: ArrayBufferLike;
  };

  export default function decodeHeic(options: {
    buffer: ArrayBuffer | Uint8Array;
  }): Promise<HeicDecodeResult>;
}

declare module "upng-js" {
  type UpngFrame = {
    delay?: number;
  };

  type UpngImage = {
    width: number;
    height: number;
    frames?: UpngFrame[];
  };

  type UpngApi = {
    decode: (buffer: ArrayBuffer) => UpngImage;
    toRGBA8: (image: UpngImage) => ArrayBuffer[];
    encode: (
      frames: ArrayBuffer[],
      width: number,
      height: number,
      colors: number,
      delays?: number[],
    ) => ArrayBuffer;
  };

  const UPNG: UpngApi;
  export default UPNG;
}

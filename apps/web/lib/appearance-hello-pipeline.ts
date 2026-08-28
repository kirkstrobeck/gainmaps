// GPU pipeline factory for the appearance hello surface.
// Isolated here so it can be replaced / tested without the full session.

import type { Rgb } from "@/lib/appearance-hello-pure";
import { UNIFORM_FLOATS, packUniform } from "@/lib/appearance-hello-pure";
import { paintMask } from "@/lib/appearance-hello-canvas";

const SHADER_CODE = `
  struct Frame {
    viewport: vec2f,
    glyphScale: f32,
    _pad: f32,
    field: vec4f,
    ink: vec4f,
  };

  @group(0) @binding(0) var<uniform> frame: Frame;
  @group(0) @binding(1) var textMap: texture_2d<f32>;
  @group(0) @binding(2) var textSamp: sampler;

  struct VsOut {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
  };

  @vertex fn vs(@builtin(vertex_index) i: u32) -> VsOut {
    var p = array<vec2f, 3>(
      vec2f(-1.0, -1.0),
      vec2f( 3.0, -1.0),
      vec2f(-1.0,  3.0)
    );
    var out: VsOut;
    out.pos = vec4f(p[i], 0.0, 1.0);
    out.uv = p[i] * vec2f(0.5, -0.5) + vec2f(0.5, 0.5);
    return out;
  }

  @fragment fn fs(in: VsOut) -> @location(0) vec4f {
    let a = textureSample(textMap, textSamp, in.uv).a;
    let glyph = frame.ink.rgb * frame.glyphScale;
    let rgb = mix(frame.field.rgb, glyph, a);
    return vec4f(rgb, 1.0);
  }
`;

export interface HelloGpuPipeline {
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  sampler: GPUSampler;
  writeUniforms(
    width: number,
    height: number,
    glyphScale: number,
    field: Rgb,
    ink: Rgb,
  ): void;
  ensureMask(
    pixelW: number,
    pixelH: number,
    cssW: number,
    cssH: number,
    helloY: number,
  ): { texture: { destroy: () => void }; view: unknown; key: string };
  destroy(): void;
}

export function createHelloPipeline(device: GPUDevice): HelloGpuPipeline {
  const module = device.createShaderModule({ code: SHADER_CODE });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module, entryPoint: "vs" },
    fragment: { module, entryPoint: "fs", targets: [{ format: "rgba16float" }] },
  });
  const uniformBuffer = device.createBuffer({
    size: UNIFORM_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });

  const textures = {
    current: null as null | { texture: { destroy: () => void }; view: unknown; key: string },
  };

  return {
    pipeline,
    uniformBuffer,
    sampler,
    writeUniforms(width, height, glyphScale, field, ink) {
      device.queue.writeBuffer(uniformBuffer, 0, packUniform(width, height, glyphScale, field, ink));
    },
    ensureMask(pixelW, pixelH, cssW, cssH, helloY) {
      const key = `${pixelW}x${pixelH}:${helloY.toFixed(1)}`;
      if (textures.current?.key === key) return textures.current;
      if (textures.current) textures.current.texture.destroy();
      const bitmap = paintMask(pixelW, pixelH, cssW, cssH, helloY);
      const texture = device.createTexture({
        size: [pixelW, pixelH],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      device.queue.copyExternalImageToTexture({ source: bitmap }, { texture }, [pixelW, pixelH]);
      textures.current = { texture, view: texture.createView(), key };
      return textures.current;
    },
    destroy() {
      if (textures.current) textures.current.texture.destroy();
    },
  };
}

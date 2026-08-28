/**
 * One Ultra surface for the appearance lab: HDR field + hello glyph.
 * Light Ultra lifts the page wash; dark Ultra lifts the glyph. Blacks stay black.
 */

import {
  fieldRgb,
  inkRgb,
  inkScale,
  type HelloState,
} from "@/lib/appearance-hello-pure";
import {
  helloCenterY,
  paintHello2d,
  readState,
  syncCanvasSize,
} from "@/lib/appearance-hello-canvas";
import { createHelloPipeline } from "@/lib/appearance-hello-pipeline";

export type { HelloState } from "@/lib/appearance-hello-pure";

type Session = {
  poke: () => void;
  stop: () => void;
};

export function startAppearanceHello(
  canvas: HTMLCanvasElement,
  lab: HTMLElement,
): Session {
  const control = {
    running: false,
    stopGpu: null as null | (() => void),
    pending: false,
    raf2d: 0,
  };

  function stop2d() {
    cancelAnimationFrame(control.raf2d);
    control.raf2d = 0;
  }

  function start2d() {
    stop2d();
    const tick = () => {
      paintHello2d(canvas, lab);
      control.raf2d = requestAnimationFrame(tick);
    };
    tick();
  }

  async function bootGpu() {
    /* v8 ignore next */
    if (control.running) return;
    if (!navigator.gpu) { start2d(); return; }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) { start2d(); return; }

    const device = await adapter.requestDevice();
    const maybeContext = canvas.getContext("webgpu");
    if (!maybeContext) { device.destroy(); start2d(); return; }
    const surface: GPUCanvasContext = maybeContext;
    stop2d();

    function configureSurface() {
      surface.configure({
        device,
        format: "rgba16float",
        colorSpace: "srgb",
        toneMapping: { mode: "extended" },
        alphaMode: "premultiplied",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }

    const helloPipeline = createHelloPipeline(device);
    const loop = { frameId: 0, running: true };

    function frame() {
      /* v8 ignore next */
      if (!loop.running) return;
      const cssW = Math.max(1, lab.clientWidth);
      const cssH = Math.max(1, lab.clientHeight);
      if (syncCanvasSize(canvas, cssW, cssH)) configureSurface();

      const state: HelloState = readState(lab);
      const field = fieldRgb(state);
      const ink = inkRgb(state);
      const glyphScale = inkScale(state);
      const helloY = helloCenterY(lab, cssH);
      const mask = helloPipeline.ensureMask(canvas.width, canvas.height, cssW, cssH, helloY);
      helloPipeline.writeUniforms(canvas.width, canvas.height, glyphScale, field, ink);

      const bindGroup = device.createBindGroup({
        layout: helloPipeline.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: helloPipeline.uniformBuffer } },
          { binding: 1, resource: mask.view },
          { binding: 2, resource: helloPipeline.sampler },
        ],
      });

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: surface.getCurrentTexture().createView(),
          clearValue: { r: field.r, g: field.g, b: field.b, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      pass.setPipeline(helloPipeline.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
      loop.frameId = requestAnimationFrame(frame);
    }

    configureSurface();
    frame();
    control.running = true;
    lab.dataset.helloSurface = "gpu";

    control.stopGpu = () => {
      loop.running = false;
      cancelAnimationFrame(loop.frameId);
      helloPipeline.destroy();
      device.destroy();
      delete lab.dataset.helloSurface;
      control.running = false;
      control.stopGpu = null;
    };
  }

  function poke() {
    if (control.running || control.raf2d) return;
    if (control.pending) return;
    control.pending = true;
    void bootGpu().finally(() => { control.pending = false; });
  }

  poke();

  return {
    poke,
    stop: () => {
      if (control.stopGpu) control.stopGpu();
      stop2d();
    },
  };
}

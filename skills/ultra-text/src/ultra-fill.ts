// Ultra mode by Kirk Strobeck – https://UltraDarkMode.com

/*
  A flat extended-range fill on a WebGPU canvas.

  Ultra white cannot be expressed in CSS paint — it needs an rgba16float surface
  with `toneMapping: { mode: "extended" }`, where values above 1.0 map onto the
  display's headroom instead of clamping at reference white.

  The canvas is 1x1: the fill is uniform, so CSS scales the single texel to size
  and the mask decides what shape it takes.
*/

export type UltraFillSession = {
  /** Redraw — WebGPU surfaces can be dropped on resize or tab restore. */
  poke(): void;
  stop(): void;
};

export type UltraFillOptions = {
  /** Linear extended-sRGB value. 1.0 = SDR reference white; above that uses headroom. */
  intensity: number;
};

function markUnsupported(canvas: HTMLCanvasElement): void {
  canvas.dataset.ultraFill = "unsupported";
}

function paint(
  device: GpuDevice,
  surface: GPUCanvasContext,
  intensity: number,
): void {
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: surface.getCurrentTexture().createView(),
        clearValue: { r: intensity, g: intensity, b: intensity, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });
  pass.end();
  device.queue.submit([encoder.finish()]);
}

export function startUltraFill(
  canvas: HTMLCanvasElement,
  options: UltraFillOptions,
): UltraFillSession {
  let device: GpuDevice | undefined;
  let surface: GPUCanvasContext | undefined;
  let stopped = false;

  void (async () => {
    const gpu = navigator.gpu;
    if (!gpu) return markUnsupported(canvas);

    const adapter = await gpu.requestAdapter();
    if (!adapter) return markUnsupported(canvas);

    const next = await adapter.requestDevice();
    if (stopped) return next.destroy();

    const context = canvas.getContext("webgpu");
    if (!context) {
      next.destroy();
      return markUnsupported(canvas);
    }

    context.configure({
      device: next,
      format: "rgba16float",
      colorSpace: "srgb",
      toneMapping: { mode: "extended" },
      alphaMode: "premultiplied",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    device = next;
    surface = context;
    paint(device, surface, options.intensity);
    canvas.dataset.ultraFill = "on";
  })();

  return {
    poke() {
      if (!device || !surface) return;
      paint(device, surface, options.intensity);
    },
    stop() {
      stopped = true;
      device?.destroy();
      device = undefined;
      surface = undefined;
    },
  };
}

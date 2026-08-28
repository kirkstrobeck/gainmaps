import type { Page } from "@playwright/test";
import type { EnvInfo } from "./types.js";

export async function probeEnv(page: Page, headless: boolean): Promise<EnvInfo> {
  await page.goto("about:blank");

  const webGpuAvailable = await page.evaluate(async () => {
    if (!navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  });

  // Check if GPU compositing is active via chrome internals
  // In headless without --use-gl=egl, raster is software
  const gpuRasterOn = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!ctx) return false;
    const dbgInfo = ctx.getExtension("WEBGL_debug_renderer_info");
    if (!dbgInfo) return false;
    const renderer = (ctx as WebGLRenderingContext).getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) as string;
    return !renderer.toLowerCase().includes("swiftshader") && !renderer.toLowerCase().includes("llvmpipe");
  }).catch(() => false);

  const chromeVersion = await page.evaluate(() => navigator.userAgent);

  return { headless, gpuRasterOn, webGpuAvailable, chromeVersion };
}

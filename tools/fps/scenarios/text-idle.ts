import type { Page } from "@playwright/test";
import { installSampler, startSampler, stopSampler } from "../sampler.js";
import { computeMetrics } from "../compute.js";
import type { FrameMetrics } from "../types.js";

const BASE_URL = process.env.FPS_BASE_URL ?? "http://127.0.0.1:3000";

/** How long to wait for the async WebGPU init to settle after networkidle. */
const WEBGPU_INIT_MS = 3000;

/**
 * Returns true only when a canvas with data-ultra-fill="on" exists in the page.
 * That attribute is set by ultra-fill.ts only after a successful WebGPU device
 * acquire and first paint — "unsupported" means the GPU path never executed.
 */
async function ultraEffectIsLive(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll("canvas.ultra-fill"));
    return canvases.some((c) => (c as HTMLElement).dataset.ultraFill === "on");
  });
}

export async function textIdle(page: Page): Promise<FrameMetrics | null> {
  await page.goto(`${BASE_URL}/text`, { waitUntil: "networkidle" });

  // Give the async WebGPU init time to resolve to either "on" or "unsupported".
  await page.waitForTimeout(WEBGPU_INIT_MS);

  const live = await ultraEffectIsLive(page);
  if (!live) {
    throw new Error(
      "NOT MEASURED: WebGPU unavailable — ultra text effect did not render",
    );
  }

  await installSampler(page);
  await startSampler(page);
  await page.waitForTimeout(5000);
  const ts = await stopSampler(page);
  return computeMetrics(ts);
}

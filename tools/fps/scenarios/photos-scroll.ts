import type { Page } from "@playwright/test";
import { installSampler, startSampler, stopSampler } from "../sampler.js";
import { computeMetrics } from "../compute.js";
import type { FrameMetrics } from "../types.js";

const BASE_URL = process.env.FPS_BASE_URL ?? "http://127.0.0.1:3000";

export async function photosScroll(page: Page): Promise<FrameMetrics | null> {
  await page.goto(`${BASE_URL}/photos`, { waitUntil: "networkidle" });
  await installSampler(page);

  const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewHeight = await page.evaluate(() => window.innerHeight);
  const steps = 12;
  const stepSize = Math.floor((bodyHeight - viewHeight) / steps);

  await startSampler(page);

  for (let i = 0; i < steps; i++) {
    await page.evaluate((y) => window.scrollBy({ top: y, behavior: "smooth" }), stepSize);
    await page.waitForTimeout(300);
  }

  // scroll back up in steps
  for (let i = 0; i < steps; i++) {
    await page.evaluate((y) => window.scrollBy({ top: y, behavior: "smooth" }), -stepSize);
    await page.waitForTimeout(300);
  }

  const ts = await stopSampler(page);
  return computeMetrics(ts);
}

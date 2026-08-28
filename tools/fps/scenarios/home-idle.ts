import type { Page } from "@playwright/test";
import { installSampler, startSampler, stopSampler } from "../sampler.js";
import { computeMetrics } from "../compute.js";
import type { FrameMetrics } from "../types.js";

const BASE_URL = process.env.FPS_BASE_URL ?? "http://127.0.0.1:3000";

export async function homeIdle(page: Page): Promise<FrameMetrics | null> {
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await installSampler(page);
  await startSampler(page);
  await page.waitForTimeout(5000);
  const ts = await stopSampler(page);
  return computeMetrics(ts);
}

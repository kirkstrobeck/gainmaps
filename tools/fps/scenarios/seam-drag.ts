import type { Page } from "@playwright/test";
import { installSampler, startSampler, stopSampler } from "../sampler.js";
import { computeMetrics } from "../compute.js";
import type { FrameMetrics } from "../types.js";

const BASE_URL = process.env.FPS_BASE_URL ?? "http://127.0.0.1:3000";

export async function seamDrag(page: Page): Promise<FrameMetrics | null> {
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await installSampler(page);

  const inst = page.locator(".inst").first();
  await inst.waitFor({ state: "visible" });
  const box = await inst.boundingBox();

  if (!box) return null;

  const y = box.y + box.height / 2;
  const leftX = box.x + box.width * 0.1;
  const rightX = box.x + box.width * 0.9;

  await startSampler(page);

  // drag left to right
  await page.mouse.move(leftX, y);
  await page.mouse.down();
  const dragSteps = 20;
  const stepW = (rightX - leftX) / dragSteps;
  for (let i = 1; i <= dragSteps; i++) {
    await page.mouse.move(leftX + stepW * i, y);
    await page.waitForTimeout(30);
  }
  // drag right to left
  for (let i = dragSteps - 1; i >= 0; i--) {
    await page.mouse.move(leftX + stepW * i, y);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();

  const ts = await stopSampler(page);
  return computeMetrics(ts);
}

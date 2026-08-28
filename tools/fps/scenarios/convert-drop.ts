import type { Page } from "@playwright/test";
import { installSampler, startSampler, stopSampler } from "../sampler.js";
import { computeMetrics } from "../compute.js";
import type { FrameMetrics } from "../types.js";

const BASE_URL = process.env.FPS_BASE_URL ?? "http://127.0.0.1:3000";

// minimal 2x2 PNG with two colours
const FIXTURE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAABGdBTUEAALGPC/xhBQAAAAJiS0dEAAHdihOkAAAADElEQVR42mM8wMBQDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export async function convertDrop(page: Page): Promise<FrameMetrics | null> {
  await page.goto(`${BASE_URL}/convert`, { waitUntil: "networkidle" });
  await installSampler(page);
  await startSampler(page);

  await page.locator("input[type=file]").setInputFiles({
    name: "fps-fixture.png",
    mimeType: "image/png",
    buffer: FIXTURE_PNG,
  });

  // sample while processing (up to 10s or until "Gain map" text appears)
  await page
    .getByText(/Gain map JPEG/)
    .waitFor({ state: "visible", timeout: 10000 })
    .catch(() => {});

  const ts = await stopSampler(page);
  return computeMetrics(ts);
}

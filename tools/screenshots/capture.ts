#!/usr/bin/env tsx
/**
 * Capture homepage screenshots with the DisplayCheckModal open.
 *
 * Clears localStorage so the modal always shows, then takes four shots:
 *   desktop / mobile × dark / light
 *
 * Usage:
 *   PREFIX=before tsx tools/screenshots/capture.ts
 *   PREFIX=after  tsx tools/screenshots/capture.ts
 *
 * Output: /workspace/tmp/shots/{prefix}-{viewport}-{mode}.png
 */

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const PREFIX = process.env.PREFIX ?? "shot";
const OUT_DIR = resolve(import.meta.dirname, "../../tmp/shots");

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const MODES: Array<{ name: string; attribute: string }> = [
  { name: "dark", attribute: "dark" },
  { name: "light", attribute: "light" },
];

async function capture() {
  await mkdir(OUT_DIR, { recursive: true });

  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch({ executablePath });

  for (const viewport of VIEWPORTS) {
    for (const mode of MODES) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });

      const page = await context.newPage();

      // Clear display-check-dismissed so modal always shows
      await page.addInitScript(() => {
        localStorage.removeItem("display-check-dismissed");
      });

      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

      // Set mode after load so CSS vars resolve correctly
      await page.evaluate((m) => {
        document.documentElement.setAttribute("data-mode", m);
      }, mode.attribute);

      // Wait for modal to appear (React useEffect fires after hydration)
      await page.waitForSelector('[role="dialog"]', { timeout: 15000 }).catch(() => {
        console.warn(`  Modal did not appear for ${viewport.name}-${mode.name} — shooting anyway`);
      });

      const filename = `${PREFIX}-${viewport.name}-${mode.name}.png`;
      const path = resolve(OUT_DIR, filename);
      await page.screenshot({ path, fullPage: false });

      console.log(`Wrote ${path}`);
      await context.close();
    }
  }

  await browser.close();
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});

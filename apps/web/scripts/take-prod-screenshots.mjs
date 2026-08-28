#!/usr/bin/env node
/**
 * Take production screenshots.
 * PLAYWRIGHT_BROWSERS_PATH=/tmp/ms-playwright node scripts/take-prod-screenshots.mjs
 */

import { chromium } from "@playwright/test";
import { mkdir } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";

const BASE_URL = process.env.BASE_URL || "https://www.gainmaps.com";
const prefix = process.argv[2] || "prod-after";
const OUT = path.resolve(fileURLToPath(import.meta.url), "../../../..", "GOAL-EVIDENCE");

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function shot(name, viewport, fn) {
  const ctx = await browser.newContext({
    viewport,
    colorScheme: name.includes("light") ? "light" : "dark",
  });
  const page = await ctx.newPage();
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4000); // let fonts load + ResizeObserver fire

  if (fn) await fn(page);

  const file = path.join(OUT, `${prefix}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved:", file);
  await ctx.close();
}

// Dark mode
await shot("desktop-dark", { width: 1440, height: 900 }, async (page) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-mode", "dark");
  });
  await page.waitForTimeout(500);
});

// Light mode
await shot("desktop-light", { width: 1440, height: 900 }, async (page) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-mode", "light");
  });
  await page.waitForTimeout(500);
});

// Mobile dark
await shot("mobile-dark", { width: 390, height: 844 });

// Modal (clear storage and reload)
await shot("modal-dark", { width: 1440, height: 900 }, async (page) => {
  await page.evaluate(() => {
    localStorage.removeItem("display-check-dismissed");
    document.documentElement.setAttribute("data-mode", "dark");
  });
  await page.reload({ waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => document.documentElement.setAttribute("data-mode", "dark"));
  await page.waitForTimeout(300);
});

await browser.close();
console.log("Done!", OUT);

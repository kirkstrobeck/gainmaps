#!/usr/bin/env node
/**
 * Playwright screenshot script for diagnosing UltraWord/hero h1 visibility.
 * Usage: PLAYWRIGHT_BROWSERS_PATH=/tmp/ms-playwright node scripts/take-screenshots.mjs [prefix]
 */

import { chromium } from "@playwright/test";
import { mkdir } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const prefix = process.argv[2] || "before";
const OUT = path.resolve(fileURLToPath(import.meta.url), "../../../..", "GOAL-EVIDENCE");

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function shot(name, viewport, fn) {
  const ctx = await browser.newContext({
    viewport,
    colorScheme: name.includes("light") ? "light" : "dark",
  });
  const page = await ctx.newPage();
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000); // let fonts + JS settle

  if (fn) await fn(page);

  const file = path.join(OUT, `${prefix}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved:", file);

  await ctx.close();
}

async function diagnoseH1(page) {
  const diag = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const ultraWord = h1?.querySelector(".ultra-word");
    const readableSpan = ultraWord?.querySelector("span:first-child");
    const backdrop = ultraWord?.querySelector(".ultra-backdrop");
    const svg = ultraWord?.querySelector("svg");
    const maskTexts = svg?.querySelectorAll("mask text") || [];

    const computed = readableSpan ? getComputedStyle(readableSpan) : null;
    const h1Computed = h1 ? getComputedStyle(h1) : null;
    const backdropComputed = backdrop ? getComputedStyle(backdrop) : null;

    return {
      h1: {
        exists: !!h1,
        text: h1?.textContent?.trim()?.slice(0, 50),
        boundingRect: h1 ? JSON.parse(JSON.stringify(h1.getBoundingClientRect())) : null,
        classList: h1 ? Array.from(h1.classList).slice(0, 10) : [],
        computedColor: h1Computed?.color,
        computedDisplay: h1Computed?.display,
        computedOverflow: h1Computed?.overflow,
        computedTextWrap: h1Computed?.textWrap,
        computedVisibility: h1Computed?.visibility,
        computedOpacity: h1Computed?.opacity,
      },
      ultraWord: {
        exists: !!ultraWord,
        boundingRect: ultraWord ? JSON.parse(JSON.stringify(ultraWord.getBoundingClientRect())) : null,
        computedOverflow: ultraWord ? getComputedStyle(ultraWord).overflow : null,
      },
      readableSpan: {
        exists: !!readableSpan,
        textContent: readableSpan?.textContent?.trim(),
        boundingRect: readableSpan ? JSON.parse(JSON.stringify(readableSpan.getBoundingClientRect())) : null,
        computedColor: computed?.color,
        computedFontSize: computed?.fontSize,
        computedLineHeight: computed?.lineHeight,
        computedVisibility: computed?.visibility,
        computedOpacity: computed?.opacity,
        computedDisplay: computed?.display,
        computedOverflow: computed?.overflow,
      },
      backdrop: {
        exists: !!backdrop,
        boundingRect: backdrop ? JSON.parse(JSON.stringify(backdrop.getBoundingClientRect())) : null,
        computedBackground: backdropComputed?.background,
        computedMask: backdropComputed?.mask,
        computedWebkitMask: backdropComputed?.webkitMask,
        computedOpacity: backdropComputed?.opacity,
        computedDisplay: backdropComputed?.display,
      },
      svg: {
        exists: !!svg,
        boundingRect: svg ? JSON.parse(JSON.stringify(svg.getBoundingClientRect())) : null,
        maskTextCount: maskTexts.length,
        maskTexts: Array.from(maskTexts).map(t => ({
          textContent: t.textContent,
          x: t.getAttribute("x"),
          y: t.getAttribute("y"),
          fill: t.getAttribute("fill"),
        })),
      },
    };
  });

  console.log("\n=== H1 DIAGNOSIS ===");
  console.log(JSON.stringify(diag, null, 2));
  return diag;
}

// Screenshot 1: desktop dark
await shot("desktop-dark", { width: 1440, height: 900 }, async (page) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-mode", "dark");
  });
  await page.waitForTimeout(500);
  const diag = await diagnoseH1(page);
  // If we're taking before shots, print full diagnosis
  if (prefix === "before") {
    console.log("\n--- Dark mode diagnosis complete ---");
  }
});

// Screenshot 2: desktop light
await shot("desktop-light", { width: 1440, height: 900 }, async (page) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-mode", "light");
  });
  await page.waitForTimeout(500);
});

// Screenshot 3: mobile dark
await shot("mobile-dark", { width: 390, height: 844 }, async (page) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-mode", "dark");
  });
  await page.waitForTimeout(500);
});

// Screenshot 4: modal dark
await shot("modal-dark", { width: 1440, height: 900 }, async (page) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-mode", "dark");
    localStorage.removeItem("display-check-dismissed");
  });
  // Need to reload to show modal (it checks localStorage on mount)
  await page.reload({ waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-mode", "dark");
  });
  await page.waitForTimeout(500);
});

await browser.close();
console.log("\nAll screenshots saved to", OUT);

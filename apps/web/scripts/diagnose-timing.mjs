#!/usr/bin/env node
/**
 * Diagnose timing: why does UltraWord mask end up empty despite correct layout?
 * PLAYWRIGHT_BROWSERS_PATH=/tmp/ms-playwright node scripts/diagnose-timing.mjs
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: "dark",
});

const page = await ctx.newPage();

// Capture ALL console messages
const consoleLogs = [];
page.on("console", msg => {
  consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
});

// Inject a monitor BEFORE the page loads (via page.addInitScript)
await page.addInitScript(() => {
  // Intercept ResizeObserver to see if it fires
  const OrigResizeObserver = window.ResizeObserver;
  window._resizeObserverFires = [];
  window.ResizeObserver = class extends OrigResizeObserver {
    observe(target, options) {
      window._resizeObserverFires.push({
        action: 'observe',
        tag: target.tagName,
        className: target.className?.slice?.(0, 50),
        time: Date.now(),
      });
      return super.observe(target, options);
    }
  };
  // Also monitor createRange
  const origCreateRange = document.createRange.bind(document);
  let rangeCallCount = 0;
  document.createRange = () => {
    rangeCallCount++;
    return origCreateRange();
  };
  window._getRangeCallCount = () => rangeCallCount;
});

await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
await page.evaluate(() => document.documentElement.setAttribute("data-mode", "dark"));
await page.waitForTimeout(4000);

const result = await page.evaluate(() => {
  const h1 = document.querySelector("h1");
  const ultraWord = h1?.querySelector(".ultra-word");
  const readableSpan = ultraWord?.querySelector("span:first-child");
  const svg = ultraWord?.querySelector("svg");
  const maskTexts = svg?.querySelectorAll("mask text") || [];

  // Force measure NOW manually
  let manualMeasureResult = null;
  if (readableSpan && svg) {
    const textNode = readableSpan.firstChild;
    if (textNode && textNode.nodeType === 3) {
      const words = Array.from(textNode.data.matchAll(/\S+(?:\s+|$)/g));
      const overlayBox = svg.getBoundingClientRect();
      const lines = new Map();

      for (const word of words) {
        const range = document.createRange();
        const index = word.index;
        range.setStart(textNode, index);
        range.setEnd(textNode, index + word[0].length);
        const box = range.getBoundingClientRect();
        const key = Math.round(box.top / 2) * 2;
        const existing = lines.get(key);
        lines.set(key, {
          text: `${existing?.text ?? ""}${word[0]}`,
          x: existing?.x ?? box.left - overlayBox.left,
          y: existing?.y ?? box.top + box.height / 2 - overlayBox.top,
          boxDebug: { top: box.top, left: box.left, width: box.width, height: box.height },
          overlayDebug: { top: overlayBox.top, left: overlayBox.left, width: overlayBox.width, height: overlayBox.height },
        });
      }

      manualMeasureResult = {
        wordsFound: words.length,
        linesFound: lines.size,
        lines: Array.from(lines.values()),
      };
    }
  }

  // Check all UltraWord instances on the page
  const allUltraWords = document.querySelectorAll(".ultra-word");
  const ultraWordSummary = Array.from(allUltraWords).map(uw => {
    const span = uw.querySelector("span:first-child");
    const s = uw.querySelector("svg");
    const maskTextCount = s?.querySelectorAll("mask text").length ?? -1;
    return {
      text: span?.textContent?.trim()?.slice(0, 20),
      maskTextCount,
      readableSpanWidth: span?.getBoundingClientRect()?.width,
      readableSpanHeight: span?.getBoundingClientRect()?.height,
    };
  });

  return {
    resizeObserverFires: window._resizeObserverFires?.slice(-5) ?? "N/A",
    rangeCallCount: window._getRangeCallCount?.() ?? "N/A",
    maskTextCount: maskTexts.length,
    maskHTML: svg?.querySelector("mask")?.innerHTML?.slice(0, 300) ?? "no mask",
    manualMeasureResult,
    allUltraWordSummary: ultraWordSummary,
  };
});

console.log("\n=== TIMING DIAGNOSIS ===");
console.log(JSON.stringify(result, null, 2));

if (consoleLogs.length > 0) {
  console.log("\n=== CONSOLE LOGS ===");
  consoleLogs.slice(-30).forEach(e => console.log(e));
}

await browser.close();

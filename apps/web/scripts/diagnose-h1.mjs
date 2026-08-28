#!/usr/bin/env node
/**
 * Deep diagnostic for UltraWord h1 blank issue.
 * PLAYWRIGHT_BROWSERS_PATH=/tmp/ms-playwright node scripts/diagnose-h1.mjs
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: "dark",
});

const page = await ctx.newPage();

// Capture console errors
const consoleErrors = [];
page.on("console", msg => {
  if (msg.type() === "error" || msg.type() === "warning") {
    consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
  }
});

await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
await page.evaluate(() => document.documentElement.setAttribute("data-mode", "dark"));
await page.waitForTimeout(3000); // wait for layout effects

const result = await page.evaluate(() => {
  const h1 = document.querySelector("h1");
  const ultraWord = h1?.querySelector(".ultra-word");
  const readableSpan = ultraWord?.querySelector("span:first-child");

  if (!readableSpan) return { error: "no readable span found" };

  const firstChild = readableSpan.firstChild;
  const textNode = firstChild;

  // Check React hydration marker nodes
  const allChildren = Array.from(readableSpan.childNodes).map(n => ({
    nodeType: n.nodeType,
    nodeName: n.nodeName,
    textContent: n.textContent?.slice(0, 30),
    data: n.nodeType === 3 ? n.data : null, // nodeType 3 = Text
    nodeTypeLabel: n.nodeType === 1 ? "ELEMENT" : n.nodeType === 3 ? "TEXT" : n.nodeType === 8 ? "COMMENT" : "OTHER",
  }));

  // Simulate what measuredLines does
  let wordsResult = null;
  let rangeResult = null;
  let boxResult = null;
  let overlayBoxResult = null;

  const svg = ultraWord?.querySelector("svg");

  if (firstChild && firstChild.nodeType === 3) {
    // It's a text node
    const textData = firstChild.data;
    const words = Array.from(textData.matchAll(/\S+(?:\s+|$)/g));
    wordsResult = words.map(w => ({
      match: w[0],
      index: w.index,
      length: w[0].length,
    }));

    if (words.length > 0) {
      const word = words[0];
      const range = document.createRange();
      range.setStart(firstChild, word.index);
      range.setEnd(firstChild, word.index + word[0].length);
      const box = range.getBoundingClientRect();
      boxResult = {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        top: box.top,
        left: box.left,
      };

      if (svg) {
        const overlayBox = svg.getBoundingClientRect();
        overlayBoxResult = {
          x: overlayBox.x,
          y: overlayBox.y,
          width: overlayBox.width,
          height: overlayBox.height,
          top: overlayBox.top,
          left: overlayBox.left,
        };

        const key = Math.round(box.top / 2) * 2;
        const x = box.left - overlayBox.left;
        const y = box.top + box.height / 2 - overlayBox.top;
        rangeResult = { key, x, y };
      }
    }
  }

  // Check if the h1's text-balance causes width calculation issues
  const h1Computed = h1 ? getComputedStyle(h1) : null;
  const h1Width = h1?.getBoundingClientRect().width;
  const h1ClientWidth = h1?.clientWidth;

  // Check all ancestors for hidden/clipped
  let el = readableSpan.parentElement;
  const ancestorIssues = [];
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    if (cs.overflow !== "visible" || cs.visibility !== "visible" || cs.opacity === "0" || cs.display === "none") {
      ancestorIssues.push({
        tagName: el.tagName,
        className: el.className?.slice(0, 50),
        overflow: cs.overflow,
        visibility: cs.visibility,
        opacity: cs.opacity,
        display: cs.display,
      });
    }
    el = el.parentElement;
  }

  return {
    readableSpanChildNodes: allChildren,
    firstChildType: firstChild?.nodeType,
    firstChildData: firstChild?.nodeType === 3 ? firstChild.data : null,
    wordsResult,
    rangeBoxResult: boxResult,
    overlayBoxResult,
    computedLineResult: rangeResult,
    h1Width,
    h1ClientWidth,
    ancestorIssues,
    svgExists: !!svg,
    svgDimensions: svg ? {
      w: svg.getBoundingClientRect().width,
      h: svg.getBoundingClientRect().height,
    } : null,
    // Check the mask text now (after effects should have run)
    maskTextCount: svg?.querySelectorAll("mask text").length,
    maskHTML: svg?.querySelector("mask")?.innerHTML?.slice(0, 200),
    // Check if there are React hydration markers (comments)
    readableSpanComments: Array.from(readableSpan.childNodes)
      .filter(n => n.nodeType === 8)
      .map(n => n.textContent),
  };
});

console.log("\n=== DEEP DIAGNOSIS ===");
console.log(JSON.stringify(result, null, 2));

if (consoleErrors.length > 0) {
  console.log("\n=== CONSOLE ERRORS ===");
  consoleErrors.forEach(e => console.log(e));
}

await browser.close();

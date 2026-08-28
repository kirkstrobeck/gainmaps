// apps/web/measure-pills.mjs
// Task 3 — Nav pill pixel accuracy measurement
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
mkdirSync('/workspace/reports/land', { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });

const rects = await page.evaluate(() => {
  const results = [];
  // Nav pills (role=switch)
  document.querySelectorAll('[role="switch"]').forEach((el, i) => {
    const r = el.getBoundingClientRect();
    results.push({ name: `pill[${i}] aria-label=${el.getAttribute('aria-label')}`, x: r.x, y: r.y, w: r.width, h: r.height });
    el.querySelectorAll('span').forEach((span, j) => {
      const s = span.getBoundingClientRect();
      results.push({ name: `  span[${j}] "${span.textContent}"`, x: s.x, y: s.y, w: s.width, h: s.height });
    });
  });
  return results;
});

console.log('\n=== BEFORE: Pill rect table ===');
console.log('name'.padEnd(45) + 'x'.padStart(8) + 'y'.padStart(8) + 'w'.padStart(8) + 'h'.padStart(8) + '  fractional?');
for (const r of rects) {
  const frac = [r.x, r.y, r.w, r.h].some(v => v !== Math.round(v));
  console.log(r.name.padEnd(45) + r.x.toFixed(2).padStart(8) + r.y.toFixed(2).padStart(8) + r.w.toFixed(2).padStart(8) + r.h.toFixed(2).padStart(8) + (frac ? '  YES' : ''));
}

// LEAD B: disable backdrop-filter
await page.evaluate(() => {
  document.querySelector('header').style.backdropFilter = 'none';
  document.querySelector('header').style.webkitBackdropFilter = 'none';
});
await page.screenshot({ path: '/workspace/reports/land/pill-no-backdrop.png' });
console.log('\nLEAD B screenshot: reports/land/pill-no-backdrop.png');

// LEAD C: active chip gap
const gaps = await page.evaluate(() => {
  const pill = document.querySelector('[role="switch"]');
  const activeSpan = pill.querySelector('span[class*="bg-[var(--foreground)]"], span[class*="bg-[var(--accent)]"]');
  if (!activeSpan) return null;
  const outer = pill.getBoundingClientRect();
  const inner = activeSpan.getBoundingClientRect();
  return {
    top: inner.top - outer.top,
    bottom: outer.bottom - inner.bottom,
    left: inner.left - outer.left,
    right: outer.right - inner.right,
  };
});
console.log('\nLEAD C active chip gap:', gaps);

// Task 4B: Check dynamic-range-limit
await page.reload({ waitUntil: 'networkidle' });
const drl = await page.evaluate(() => {
  const html = document.documentElement;
  const body = document.body;
  const gainmapImgs = document.querySelectorAll('.gainmap-image');
  const style = (el) => getComputedStyle(el).getPropertyValue('dynamic-range-limit') || 'not set';
  return {
    html: style(html),
    body: style(body),
    gainmapImages: Array.from(gainmapImgs).map((img, i) => ({ i, src: img.src?.split('/').pop(), drl: style(img) })),
    instGainmapImages: Array.from(document.querySelectorAll('.inst .gainmap-image')).map((img, i) => ({ i, drl: style(img) })),
  };
});
console.log('\n=== BEFORE: dynamic-range-limit ===');
console.log('dynamic-range-limit:', JSON.stringify(drl, null, 2));

// Task 5: Type instrument metrics at 1440x900
const typeMetrics1440 = await page.evaluate(() => {
  const typeInst = document.querySelectorAll('.inst')[1];
  if (!typeInst) return null;
  const containerRect = typeInst.getBoundingClientRect();
  const wordEl = typeInst.querySelector('.inst-type-std') || typeInst.querySelector('[class*="inst-type"]');
  const wordRect = wordEl ? wordEl.getBoundingClientRect() : null;
  return { container: { w: containerRect.width, h: containerRect.height }, word: wordRect ? { w: wordRect.width, h: wordRect.height } : null };
});
console.log('\n=== Task 5: Type metrics 1440x900 ===');
console.log(JSON.stringify(typeMetrics1440, null, 2));
if (typeMetrics1440?.word && typeMetrics1440?.container) {
  const ratio = typeMetrics1440.word.w / typeMetrics1440.container.w;
  console.log(`Width ratio: ${(ratio * 100).toFixed(1)}% (target ≥ 60%)`);
  if (ratio < 0.60) console.log('WARNING: ratio < 60%!');
  if (typeMetrics1440.word.w > typeMetrics1440.container.w) console.log('WARNING: word overflows container!');
}

await browser.close();

// Relaunch at mobile viewport for Task 5
const browser2 = await chromium.launch({ args: ['--no-sandbox'] });
const ctx2 = await browser2.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page2 = await ctx2.newPage();
await page2.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });

const typeMetrics390 = await page2.evaluate(() => {
  const typeInst = document.querySelectorAll('.inst')[1];
  if (!typeInst) return null;
  const containerRect = typeInst.getBoundingClientRect();
  const wordEl = typeInst.querySelector('.inst-type-std') || typeInst.querySelector('[class*="inst-type"]');
  const wordRect = wordEl ? wordEl.getBoundingClientRect() : null;
  return { container: { w: containerRect.width, h: containerRect.height }, word: wordRect ? { w: wordRect.width, h: wordRect.height } : null };
});
console.log('\n=== Task 5: Type metrics 390x844 ===');
console.log(JSON.stringify(typeMetrics390, null, 2));
if (typeMetrics390?.word && typeMetrics390?.container) {
  const ratio = typeMetrics390.word.w / typeMetrics390.container.w;
  console.log(`Width ratio: ${(ratio * 100).toFixed(1)}% (target ≥ 60%)`);
  if (ratio < 0.60) console.log('WARNING: ratio < 60%!');
  if (typeMetrics390.word.w > typeMetrics390.container.w) console.log('WARNING: word overflows container!');
}

await page2.screenshot({ path: '/workspace/reports/land/type-mobile.png' });
console.log('Screenshot: reports/land/type-mobile.png');

await browser2.close();

// Proof of pill toggle: click outer area of pill
const browser3 = await chromium.launch({ args: ['--no-sandbox'] });
const ctx3 = await browser3.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page3 = await ctx3.newPage();
await page3.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });

const pillBefore = await page3.evaluate(() => document.documentElement.getAttribute('data-ultra'));
console.log(`\n=== Pill toggle proof ===`);
console.log(`data-ultra BEFORE: ${pillBefore}`);

// Click top-left corner of pill (padding area, not a span) via raw mouse
const ultraPill = page3.getByRole('switch', { name: 'Ultra display' }).first();
const box = await ultraPill.boundingBox();
console.log(`pill boundingBox: x=${box?.x} y=${box?.y} w=${box?.width} h=${box?.height}`);
await page3.mouse.click(box.x + 2, box.y + 2);
await page3.waitForTimeout(300);
const pillAfter1 = await page3.evaluate(() => document.documentElement.getAttribute('data-ultra'));
console.log(`data-ultra AFTER click top-left corner (raw mouse): ${pillAfter1}`);

// Also try via locator .click() for reliability
await ultraPill.click();
await page3.waitForTimeout(300);
const pillAfter2 = await page3.evaluate(() => document.documentElement.getAttribute('data-ultra'));
console.log(`data-ultra AFTER locator .click(): ${pillAfter2}`);

await ultraPill.click();
await page3.waitForTimeout(300);
const pillAfter3 = await page3.evaluate(() => document.documentElement.getAttribute('data-ultra'));
console.log(`data-ultra AFTER second locator .click(): ${pillAfter3}`);

const rawToggled = pillBefore !== pillAfter1;
const locatorToggled = pillAfter1 !== pillAfter2 && pillAfter2 !== pillAfter3;
console.log(`Raw mouse toggle works: ${rawToggled ? 'YES' : 'NO'}`);
console.log(`Locator toggle works: ${locatorToggled ? 'YES' : 'NO'}`);

// Desktop type screenshot
await page3.screenshot({ path: '/workspace/reports/land/type-desktop.png' });
console.log('Screenshot: reports/land/type-desktop.png');

// AFTER pill rects (same viewport)
const rectsAfter = await page3.evaluate(() => {
  const results = [];
  document.querySelectorAll('[role="switch"]').forEach((el, i) => {
    const r = el.getBoundingClientRect();
    results.push({ name: `pill[${i}] aria-label=${el.getAttribute('aria-label')}`, x: r.x, y: r.y, w: r.width, h: r.height });
    el.querySelectorAll('span').forEach((span, j) => {
      const s = span.getBoundingClientRect();
      results.push({ name: `  span[${j}] "${span.textContent}"`, x: s.x, y: s.y, w: s.width, h: s.height });
    });
  });
  return results;
});

console.log('\n=== AFTER: Pill rect table ===');
console.log('name'.padEnd(45) + 'x'.padStart(8) + 'y'.padStart(8) + 'w'.padStart(8) + 'h'.padStart(8) + '  fractional?');
for (const r of rectsAfter) {
  const frac = [r.x, r.y, r.w, r.h].some(v => v !== Math.round(v));
  console.log(r.name.padEnd(45) + r.x.toFixed(2).padStart(8) + r.y.toFixed(2).padStart(8) + r.w.toFixed(2).padStart(8) + r.h.toFixed(2).padStart(8) + (frac ? '  YES' : ''));
}

await browser3.close();

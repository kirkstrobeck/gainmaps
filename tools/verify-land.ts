// Verification script: landing page smoke check for http://127.0.0.1:3000/
// Run: npx tsx tools/verify-land.ts

// Must be run from /workspace/apps/web (where @playwright/test is installed)
// or with NODE_PATH set. The smoke suite runs from there already.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const EXEC = "/ms-playwright/chromium-1187/chrome-linux/chrome";
const URL = "http://127.0.0.1:3000/";
const VIEWPORTS = [
  { w: 1440, h: 900,  out: "reports/land/desktop.png" },
  { w: 390,  h: 844,  out: "reports/land/mobile.png"  },
];

async function checkViewport(w: number, h: number, out: string) {
  const browser = await chromium.launch({
    executablePath: EXEC,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: w, height: h } });

  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (m) => {
    consoleMessages.push(`[${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => pageErrors.push(`[pageerror] ${e.message}`));

  const resp = await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
  const status = resp?.status();

  const h1 = await page.locator("h1").first().innerText().catch(() => "(no h1)");

  const seamX = await page.evaluate(() => {
    const el = document.querySelector(".inst");
    return el ? getComputedStyle(el).getPropertyValue("--seam-x").trim() : "NOT FOUND";
  });

  const heroImgs = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".inst-img")).map((img) => {
      const i = img as HTMLImageElement;
      return { src: i.src, nw: i.naturalWidth, nh: i.naturalHeight };
    })
  );

  mkdirSync("reports/land", { recursive: true });
  await page.screenshot({ path: out, fullPage: false });

  console.log(`\n=== ${w}x${h} ===`);
  console.log(`STATUS: ${status}`);
  console.log(`H1: "${h1}"`);
  console.log(`SEAM_X_ON_FIRST_PAINT: ${seamX}`);
  console.log(`HERO_IMGS (${heroImgs.length}):`);
  for (const img of heroImgs) {
    console.log(`  src=${img.src}`);
    console.log(`  naturalWidth=${img.nw}  naturalHeight=${img.nh}`);
    if (img.nw === 0) console.error(`  *** BROKEN: naturalWidth is 0 ***`);
  }
  console.log(`CONSOLE_MESSAGES (${consoleMessages.length}):`);
  for (const m of consoleMessages) console.log(`  ${m}`);
  console.log(`PAGE_ERRORS (${pageErrors.length}):`);
  for (const e of pageErrors) console.log(`  ${e}`);
  console.log(`SCREENSHOT: ${out}`);

  await browser.close();
  return { status, h1, seamX, heroImgs, consoleMessages, pageErrors };
}

(async () => {
  const results = [];
  for (const vp of VIEWPORTS) {
    results.push(await checkViewport(vp.w, vp.h, vp.out));
  }

  // Fail fast on broken hero
  for (const r of results) {
    const broken = r.heroImgs.filter((i) => i.nw === 0);
    if (broken.length > 0) {
      console.error(`\nFAIL: ${broken.length} hero img(s) have naturalWidth=0`);
      process.exit(1);
    }
  }
  console.log("\nALL CHECKS PASSED");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

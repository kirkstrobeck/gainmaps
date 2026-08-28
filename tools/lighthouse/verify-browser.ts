#!/usr/bin/env tsx
/**
 * Browser verification using Playwright.
 * Usage: tsx tools/lighthouse/verify-browser.ts --port <PORT>
 */

import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
const { chromium } = _require(
  "/workspace/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core"
);
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

// Parse --port argument
const portArg = process.argv.indexOf("--port");
if (portArg === -1 || !process.argv[portArg + 1]) {
  console.error("Usage: tsx verify-browser.ts --port <PORT>");
  process.exit(1);
}
const PORT = parseInt(process.argv[portArg + 1], 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const CHROME_PATH = process.env.CHROME_PATH;
if (!CHROME_PATH || !existsSync(CHROME_PATH)) {
  console.error(`Chrome not found at CHROME_PATH=${CHROME_PATH}`);
  process.exit(1);
}

const reportsDir = resolve(root, ".reports");
if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

interface NetworkEntry {
  url: string;
  status: number;
  size: number;
}

interface ImgInfo {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  complete: boolean;
  opacity: string;
  rect: { x: number; y: number; width: number; height: number };
}

async function main() {
  console.log(`Chrome: ${CHROME_PATH}`);
  console.log(`Base URL: ${BASE_URL}`);

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    // ─── Homepage ──────────────────────────────────────────────────────────
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const networkLog: NetworkEntry[] = [];
    page.on("response", async (resp) => {
      let size = 0;
      try {
        const body = await resp.body();
        size = body.length;
      } catch {
        size = -1;
      }
      networkLog.push({ url: resp.url(), status: resp.status(), size });
    });

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    // Screenshot desktop 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: resolve(reportsDir, "screenshot-desktop.png"), fullPage: false });
    console.log("Desktop screenshot saved.");

    // Screenshot mobile 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: resolve(reportsDir, "screenshot-mobile.png"), fullPage: false });
    console.log("Mobile screenshot saved.");

    // Reset viewport for inspection
    await page.setViewportSize({ width: 1440, height: 900 });

    // Collect img elements
    const imgs: ImgInfo[] = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("img")).map((img) => {
        const style = window.getComputedStyle(img);
        const rect = img.getBoundingClientRect();
        return {
          src: img.src || img.getAttribute("src") || "",
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          complete: img.complete,
          opacity: style.opacity,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        };
      });
    });

    // .gainmap-image computed styles
    const gainmapStyle = await page.evaluate(() => {
      const el = document.querySelector(".gainmap-image") as HTMLElement | null;
      if (!el) return null;
      const s = window.getComputedStyle(el);
      return {
        dynamicRangeLimit: s.getPropertyValue("dynamic-range-limit"),
        opacity: s.opacity,
        visibility: s.visibility,
        display: s.display,
      };
    });

    // data-ultra attribute
    const dataUltra = await page.evaluate(() =>
      document.documentElement.getAttribute("data-ultra")
    );

    // Print homepage network summary
    console.log("\n=== Homepage Network Requests ===");
    const nonOk = networkLog.filter((e) => e.status !== 200);
    console.log(`Total requests: ${networkLog.length}`);
    console.log(`Non-200 count: ${nonOk.length}`);
    for (const e of nonOk) {
      console.log(`  [${e.status}] ${e.url}`);
    }

    console.log("\n=== Images on Homepage ===");
    for (const img of imgs) {
      console.log(
        `  src=${img.src.slice(0, 80)} | ${img.naturalWidth}x${img.naturalHeight} complete=${img.complete} opacity=${img.opacity}`
      );
    }

    console.log("\n=== .gainmap-image computed styles ===");
    console.log(JSON.stringify(gainmapStyle, null, 2));

    console.log(`\n=== data-ultra: ${dataUltra} ===`);

    // MPF marker check — find a gainmap.jpg URL and check first bytes
    const gainmapUrl = networkLog.find(
      (e) => e.url.includes("gainmap") && e.url.match(/\.(jpg|jpeg)/i)
    );
    let mpfResult = "No gainmap.jpg URL found in network requests";
    if (gainmapUrl) {
      console.log(`\nChecking MPF in: ${gainmapUrl.url}`);
      const resp = await page.evaluate(async (url) => {
        const r = await fetch(url, { cache: "no-store" });
        const buf = await r.arrayBuffer();
        const bytes = new Uint8Array(buf.slice(0, 64));
        return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
      }, gainmapUrl.url);
      const hexStr = resp;
      // MPF marker is "MPF\0" = 4d 50 46 00
      const hasMpf = hexStr.includes("4d 50 46 00") || hexStr.includes("4d504600");
      mpfResult = `URL: ${gainmapUrl.url}\nFirst 64 bytes: ${hexStr}\nMPF marker found: ${hasMpf}`;
      console.log(mpfResult);
    }

    // ─── /convert page ─────────────────────────────────────────────────────
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();

    const convertErrors: string[] = [];
    const convertPageErrors: string[] = [];
    const convertFailedRequests: string[] = [];

    page2.on("console", (msg) => {
      if (msg.type() === "error") convertErrors.push(msg.text());
    });
    page2.on("pageerror", (err) => convertPageErrors.push(err.message));
    page2.on("requestfailed", (req) =>
      convertFailedRequests.push(`${req.url()} — ${req.failure()?.errorText}`)
    );

    await page2.goto(`${BASE_URL}/convert`, { waitUntil: "networkidle" });

    const hasFileInput = await page2.evaluate(
      () => !!document.querySelector('input[type="file"]')
    );
    const hasForm = await page2.evaluate(() => !!document.querySelector("form"));

    console.log("\n=== /convert page ===");
    console.log(`Console errors: ${convertErrors.length}`);
    for (const e of convertErrors) console.log(`  ERROR: ${e}`);
    console.log(`Page errors: ${convertPageErrors.length}`);
    for (const e of convertPageErrors) console.log(`  PAGEERROR: ${e}`);
    console.log(`Failed requests: ${convertFailedRequests.length}`);
    for (const e of convertFailedRequests) console.log(`  FAILED: ${e}`);
    console.log(`File input present: ${hasFileInput}`);
    console.log(`Form present: ${hasForm}`);

    await ctx2.close();

    // Write JSON summary for the report
    const summary = {
      port: PORT,
      chromePath: CHROME_PATH,
      homepage: {
        networkTotal: networkLog.length,
        nonOk: nonOk,
        allRequests: networkLog.map((e) => ({ url: e.url, status: e.status, size: e.size })),
        imgs,
        gainmapStyle,
        dataUltra,
        consoleErrors,
        pageErrors,
        mpfResult,
      },
      convert: {
        consoleErrors: convertErrors,
        pageErrors: convertPageErrors,
        failedRequests: convertFailedRequests,
        hasFileInput,
        hasForm,
      },
    };
    writeFileSync(
      resolve(reportsDir, "verify-browser.json"),
      JSON.stringify(summary, null, 2)
    );
    console.log("\nSummary written to .reports/verify-browser.json");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

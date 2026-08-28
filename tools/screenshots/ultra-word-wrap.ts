#!/usr/bin/env tsx
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
const outDir = resolve(import.meta.dirname, "../../tmp/shots");
const paths = ["/docs", "/developers", "/missing-ultra-word"];

async function run() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath });
  const output: unknown[] = [];

  for (const path of paths) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle", timeout: 45_000 });
    await page.getByRole("button", { name: "Got it" }).click({ timeout: 2_000 }).catch(() => undefined);
    const result = await page.evaluate(`(() => {
      const heading = document.querySelector("h1");
      const readable = heading?.querySelector(".ultra-word > span:not([aria-hidden])");
      const maskLines = Array.from(heading?.querySelectorAll(".ultra-word mask text") ?? []);
      return {
        heading: heading?.textContent,
        readableLines: readable?.getClientRects().length ?? 0,
        maskLines: maskLines.length,
        maskText: maskLines.map((line) => line.textContent),
        foreignObject: heading?.querySelector("foreignObject") !== null,
      };
    })()`);
    const name = path === "/missing-ultra-word" ? "not-found" : path.slice(1);
    await page.screenshot({ path: resolve(outDir, `h1-wrap-${name}.png`), fullPage: false });
    output.push({ path, result });
    await context.close();
  }

  await browser.close();
  const text = JSON.stringify(output, null, 2);
  await writeFile(resolve(outDir, "h1-wrap-diagnostic.json"), `${text}\n`);
  console.log(text);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

#!/usr/bin/env tsx
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Scenario = {
  name: string;
  url: string;
};

const scenarios: Scenario[] = [
  { name: "production", url: process.env.PRODUCTION_URL ?? "https://www.gainmaps.com/" },
  { name: "local", url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000/" },
];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const modes = ["light", "dark"] as const;
const prefix = process.env.PREFIX ?? "h1-before";
const outDir = resolve(import.meta.dirname, "../../tmp/shots");

async function run() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  const output: unknown[] = [];

  for (const scenario of scenarios) {
    for (const viewport of viewports) {
      for (const mode of modes) {
        const context = await browser.newContext({
          colorScheme: mode,
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();
        await page.goto(scenario.url, { waitUntil: "networkidle", timeout: 45_000 });
        await page.getByRole("button", { name: "Got it" }).click({ timeout: 2_000 }).catch(() => undefined);
        await page.evaluate(`document.documentElement.dataset.mode = ${JSON.stringify(mode)}`);
        const diagnostic = await page.evaluate(`(() => {
          const word = document.querySelector("h1 .ultra-word");
          const h1 = document.querySelector("h1");
          const backdrop = word?.querySelector(".ultra-backdrop");
          const fill = word?.querySelector(".ultra-fill");
          const foreignObject = word?.querySelector("foreignObject");
          const inner = foreignObject?.firstElementChild;
          const rect = (element) => element ? element.getBoundingClientRect().toJSON() : null;
          const style = (element) => element ? getComputedStyle(element) : null;
          const backStyle = style(backdrop);
          const fillStyle = style(fill);
          const maskId = word?.querySelector("mask")?.id ?? null;

          return {
            mode: document.documentElement.dataset.mode ?? null,
            ultra: document.documentElement.dataset.ultra ?? null,
            h1: rect(h1),
            backdrop: {
              rect: rect(backdrop), backgroundColor: backStyle?.backgroundColor ?? null,
              opacity: backStyle?.opacity ?? null, maskImage: backStyle?.maskImage ?? null,
              webkitMaskImage: backStyle?.webkitMaskImage ?? null, display: backStyle?.display ?? null,
            },
            fill: {
              rect: rect(fill), backgroundColor: fillStyle?.backgroundColor ?? null,
              opacity: fillStyle?.opacity ?? null, maskImage: fillStyle?.maskImage ?? null,
              webkitMaskImage: fillStyle?.webkitMaskImage ?? null, display: fillStyle?.display ?? null,
            },
            maskId, idResolves: maskId ? Boolean(document.getElementById(maskId)) : false,
            foreignObject: { rect: rect(foreignObject), innerRect: rect(inner), innerNamespace: inner?.namespaceURI ?? null },
            prefersLight: matchMedia("(prefers-color-scheme: light)").matches,
          };
        })()`);
        const name = `${prefix}-${scenario.name}-${viewport.name}-${mode}`;
        await page.screenshot({ path: resolve(outDir, `${name}.png`), fullPage: false });
        output.push({ scenario: scenario.name, viewport: viewport.name, colorScheme: mode, diagnostic });
        await context.close();
      }
    }
  }

  await browser.close();
  const text = JSON.stringify(output, null, 2);
  await writeFile(resolve(outDir, `${prefix}-diagnostic.json`), `${text}\n`);
  console.log(text);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

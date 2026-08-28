#!/usr/bin/env tsx
/**
 * FPS measurement. Runs 5 interaction scenarios 3 times each via Playwright,
 * writes tools/fps/results.json, then fails the process if any measured
 * scenario's mean FPS is below 60.
 *
 * Usage:
 *   FPS_BASE_URL=http://127.0.0.1:3000 pnpm tsx tools/fps/measure.ts
 *   pnpm fps:assert   # re-check the last results.json without re-measuring
 */

import { chromium } from "@playwright/test";
import { probeEnv } from "./gpu-probe.js";
import { photosScroll } from "./scenarios/photos-scroll.js";
import { seamDrag } from "./scenarios/seam-drag.js";
import { textIdle } from "./scenarios/text-idle.js";
import { homeIdle } from "./scenarios/home-idle.js";
import { convertDrop } from "./scenarios/convert-drop.js";
import { formatEnv, formatRun } from "./format.js";
import type { ScenarioRun, FrameMetrics } from "./types.js";

type ScenarioFn = (page: import("@playwright/test").Page) => Promise<FrameMetrics | null>;

interface ScenarioDef {
  name: string;
  fn: ScenarioFn;
}

const SCENARIOS: ScenarioDef[] = [
  { name: "/photos scroll", fn: photosScroll },
  { name: "/ seam drag", fn: seamDrag },
  { name: "/text idle 5s", fn: textIdle },
  { name: "/ home idle 5s", fn: homeIdle },
  { name: "/convert drop", fn: convertDrop },
];

const RUNS = 3;

async function runScenario(
  page: import("@playwright/test").Page,
  def: ScenarioDef,
  run: number,
): Promise<ScenarioRun> {
  try {
    const metrics = await def.fn(page);
    return { scenario: def.name, run, metrics };
  } catch (err) {
    return { scenario: def.name, run, metrics: null, error: String(err) };
  }
}

// SwiftShader Vulkan ICD path so Chrome can use software WebGPU
const SWIFTSHADER_ICD =
  "/ms-playwright/chromium-1187/chrome-linux/vk_swiftshader_icd.json";
process.env.VK_ICD_FILENAMES = SWIFTSHADER_ICD;

async function main(): Promise<void> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // WebGPU via SwiftShader software Vulkan
      "--enable-unsafe-webgpu",
      "--use-vulkan",
      "--use-angle=vulkan",
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization",
      "--disable-gpu-sandbox",
    ],
    executablePath: "/ms-playwright/chromium-1187/chrome-linux/chrome",
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const probePage = await context.newPage();

  const env = await probeEnv(probePage, true);
  await probePage.close();

  console.log("=== ENV ===");
  console.log(formatEnv(env));
  console.log("");

  const results: ScenarioRun[] = [];

  for (const def of SCENARIOS) {
    for (let run = 1; run <= RUNS; run++) {
      const page = await context.newPage();
      const result = await runScenario(page, def, run);
      await page.close();
      results.push(result);
      console.log(formatRun(result));
      console.log("");
    }
  }

  await browser.close();

  // Write JSON for machine consumption
  const jsonOut = JSON.stringify({ env, results }, null, 2);
  const { writeFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  writeFileSync(resolve(__dirname, "results.json"), jsonOut, "utf8");
  console.log("Results written to tools/fps/results.json");

  // Threshold gate: all measured scenarios must sustain ≥60fps mean
  const MIN_FPS = 60;
  const failures = results.filter(
    (r) => r.metrics !== null && r.metrics.meanFps < MIN_FPS,
  );
  if (failures.length > 0) {
    console.error("\n=== FPS GATE FAILURES ===");
    for (const f of failures) {
      console.error(
        `FAIL  ${f.scenario} run ${f.run}: meanFps=${f.metrics!.meanFps.toFixed(2)} < ${MIN_FPS}`,
      );
    }
    process.exit(1);
  }
  console.log(`\nFPS gate passed — all scenarios ≥ ${MIN_FPS} fps`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

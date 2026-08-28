#!/usr/bin/env tsx
/**
 * Assert that the last FPS measurement in results.json meets the 60fps gate.
 * Used by CI after `measure.ts` has already run and written results.json.
 *
 * Usage:
 *   pnpm tsx tools/fps/assert.ts
 *   pnpm tsx tools/fps/assert.ts --min-fps 60
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ScenarioRun } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const fpsFlag = args.indexOf("--min-fps");
const MIN_FPS = fpsFlag >= 0 ? Number(args[fpsFlag + 1]) : 60;

interface ResultsFile {
  results: ScenarioRun[];
}

const file = resolve(__dirname, "results.json");
let data: ResultsFile;
try {
  data = JSON.parse(readFileSync(file, "utf8")) as ResultsFile;
} catch {
  console.error(`Cannot read ${file} — run 'pnpm fps' first`);
  process.exit(1);
}

const { results } = data;
let passed = 0;
let failed = 0;
let unmeasured = 0;

for (const r of results) {
  const label = `${r.scenario} run ${r.run}`;

  if (!r.metrics) {
    const errText = r.error ?? "no metrics";
    console.error(`FAIL  ${label}: NOT MEASURED (${errText})`);
    unmeasured++;
    continue;
  }

  const fps = r.metrics.meanFps;
  if (fps >= MIN_FPS) {
    console.log(`PASS  ${label}: ${fps.toFixed(2)} fps`);
    passed++;
    continue;
  }

  console.error(`FAIL  ${label}: ${fps.toFixed(2)} fps < ${MIN_FPS}`);
  failed++;
}

console.log(
  `\n${passed} passed, ${failed} failed, ${unmeasured} unmeasured (threshold: ${MIN_FPS} fps)`,
);
if (failed > 0 || unmeasured > 0) process.exit(1);

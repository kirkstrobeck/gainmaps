#!/usr/bin/env npx tsx
// Measure p99Luma and whiteFrac for all 100 photo standard-1280.jpg files
// and all 100 logo logo-gainmap-1024.jpg files (or gainmap.jpg if 1024 not present).
import { readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const WHITE_Y = 0.9;
const P99 = (arr: number[]) => {
  arr.sort((a, b) => a - b);
  return arr[Math.min(arr.length - 1, Math.ceil(0.99 * arr.length) - 1)] ?? 0;
};
function rec709(r: number, g: number, b: number) {
  return 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
}

async function measure(path: string, edge = 320) {
  const { data, info } = await sharp(path)
    .resize(edge, edge, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const lumas: number[] = [];
  const ch = info.channels ?? 3;
  for (let i = 0; i < info.width * info.height; i++) {
    lumas.push(rec709(data[i * ch]!, data[i * ch + 1]!, data[i * ch + 2]!));
  }
  const p99 = P99(lumas);
  const wf = lumas.filter((y) => y >= WHITE_Y).length / lumas.length;
  return { p99, wf };
}

const THRESHOLD_P99 = 0.95;
const THRESHOLD_WF = 0.05;
function verdict(p99: number, wf: number): string {
  return p99 >= THRESHOLD_P99 && wf >= THRESHOLD_WF ? "PASS" : "FAIL";
}

const lines: string[] = [
  "# Luminance Audit — All 200 Assets",
  "",
  `Threshold: p99Luma ≥ ${THRESHOLD_P99} AND whiteFrac ≥ ${THRESHOLD_WF}`,
  "",
  "## Photos (100)",
  "",
  "| slug | p99Luma | whiteFrac | verdict |",
  "| --- | --- | --- | --- |",
];
const photosRoot = "apps/web/public/photos";
let photosPass = 0;
let photosTotal = 0;
for (const dir of readdirSync(photosRoot).sort()) {
  const p = join(photosRoot, dir, "standard-1280.jpg");
  if (!existsSync(p)) {
    lines.push(`| ${dir} | MISSING | MISSING | FAIL |`);
    photosTotal++;
    continue;
  }
  const { p99, wf } = await measure(p);
  const v = verdict(p99, wf);
  if (v === "PASS") photosPass++;
  photosTotal++;
  lines.push(`| ${dir} | ${p99.toFixed(3)} | ${wf.toFixed(4)} | ${v} |`);
}

lines.push("", "## Logos (100)", "", "| slug | p99Luma | whiteFrac | verdict |", "| --- | --- | --- | --- |");
const logosRoot = "apps/web/public/logos";
let logosPass = 0;
let logosTotal = 0;
for (const dir of readdirSync(logosRoot).sort()) {
  let p = join(logosRoot, dir, "logo-gainmap-1024.jpg");
  if (!existsSync(p)) p = join(logosRoot, dir, "logo-gainmap.jpg");
  if (!existsSync(p)) {
    lines.push(`| ${dir} | MISSING | MISSING | FAIL |`);
    logosTotal++;
    continue;
  }
  const { p99, wf } = await measure(p);
  const v = verdict(p99, wf);
  if (v === "PASS") logosPass++;
  logosTotal++;
  lines.push(`| ${dir} | ${p99.toFixed(3)} | ${wf.toFixed(4)} | ${v} |`);
}

lines.push("", `${photosPass}/${photosTotal} photos pass, ${logosPass}/${logosTotal} logos pass`);

writeFileSync("GOAL-EVIDENCE/luminance.md", lines.join("\n") + "\n");
console.log("Written GOAL-EVIDENCE/luminance.md");
console.log(`${photosPass}/${photosTotal} photos pass, ${logosPass}/${logosTotal} logos pass`);

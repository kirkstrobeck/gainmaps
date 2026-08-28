#!/usr/bin/env npx tsx
/**
 * Audit logo SVGs for near-white ink pixels.
 * Usage: npx tsx tools/logos/audit-ink.ts
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { COMPANIES } from "../../apps/web/lib/logos/companies.ts";

const SIZE = 512;

function sRGBToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

type AuditResult = {
  slug: string;
  name: string;
  rank: number;
  inkPixels: number;
  maxLuminance: number;
  whiteFraction: number;
};

const results: AuditResult[] = [];

for (const company of COMPANIES) {
  const svgPath = join("apps/web/public/logos", company.slug, "logo.svg");
  let svg: Buffer;
  try { svg = await readFile(svgPath); } catch { continue; }

  const probe = await sharp(svg).metadata();
  const longest = Math.max(probe.width ?? SIZE, probe.height ?? SIZE);
  const density = Math.min(2400, Math.max(72, Math.round(72 * SIZE / Math.max(longest, 1))));

  const logo = await sharp(svg, { density })
    .resize({ width: SIZE, height: SIZE, fit: "inside", withoutEnlargement: false })
    .png().toBuffer();

  const { data } = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, gravity: "centre" }])
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  let inkPixels = 0, whitePixels = 0, maxLum = 0;
  const count = SIZE * SIZE;
  for (let i = 0; i < count; i++) {
    const a = data[i * 4 + 3]!;
    if (a < 128) continue;  // transparent — not ink
    inkPixels++;
    const lr = sRGBToLinear(data[i * 4]!);
    const lg = sRGBToLinear(data[i * 4 + 1]!);
    const lb = sRGBToLinear(data[i * 4 + 2]!);
    const lum = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    if (lum > maxLum) maxLum = lum;
    if (lum >= 0.90) whitePixels++;
  }
  const whiteFraction = inkPixels > 0 ? whitePixels / inkPixels : 0;
  results.push({ slug: company.slug, name: company.name, rank: company.rank, inkPixels, maxLuminance: maxLum, whiteFraction });
}

// Sort ascending by whiteFraction
results.sort((a, b) => a.whiteFraction - b.whiteFraction);

console.log("slug".padEnd(25) + "name".padEnd(25) + "rank".padEnd(6) + "inkPx".padEnd(8) + "maxLum".padEnd(10) + "whiteFrac");
console.log("-".repeat(90));
for (const r of results) {
  const flag = r.whiteFraction < 0.02 ? " ← DROP" : "";
  console.log(
    r.slug.padEnd(25) +
    r.name.slice(0, 24).padEnd(25) +
    String(r.rank).padEnd(6) +
    String(r.inkPixels).padEnd(8) +
    r.maxLuminance.toFixed(4).padEnd(10) +
    r.whiteFraction.toFixed(4) + flag
  );
}

const toKeep = results.filter(r => r.whiteFraction >= 0.02);
const toDrop = results.filter(r => r.whiteFraction < 0.02);
console.log(`\nKeep: ${toKeep.length}, Drop: ${toDrop.length}`);

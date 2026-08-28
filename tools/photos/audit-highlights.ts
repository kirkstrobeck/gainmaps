#!/usr/bin/env npx tsx
/**
 * Audit photo gain maps for highlight coverage.
 * Usage: npx tsx tools/photos/audit-highlights.ts
 */
import { join } from "node:path";
import sharp from "sharp";
import { PHOTOS } from "../../apps/web/lib/photos/catalog.ts";

function sRGBToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

type PhotoAudit = {
  slug: string;
  highlightFraction: number;
  p99: number;
};

const results: PhotoAudit[] = [];

for (const photo of PHOTOS) {
  const path = join("apps/web/public/photos", photo.slug, "gainmap-400.jpg");
  let data: Buffer, width: number, height: number;
  try {
    const result = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    data = result.data;
    width = result.info.width;
    height = result.info.height;
  } catch {
    console.warn(`missing: ${path}`);
    continue;
  }

  const luminances: number[] = [];
  const count = width * height;
  for (let i = 0; i < count; i++) {
    const lr = sRGBToLinear(data[i * 4]!);
    const lg = sRGBToLinear(data[i * 4 + 1]!);
    const lb = sRGBToLinear(data[i * 4 + 2]!);
    luminances.push(0.2126 * lr + 0.7152 * lg + 0.0722 * lb);
  }
  luminances.sort((a, b) => a - b);
  const highlightFraction = luminances.filter(l => l >= 0.75).length / luminances.length;
  const p99 = luminances[Math.floor(luminances.length * 0.99)]!;
  results.push({ slug: photo.slug, highlightFraction, p99 });
}

results.sort((a, b) => a.highlightFraction - b.highlightFraction);

console.log("slug".padEnd(65) + "highlightFrac".padEnd(15) + "p99");
console.log("-".repeat(95));
for (const r of results) {
  const flag = r.highlightFraction < 0.02 ? " ← DROP" : "";
  console.log(r.slug.slice(0, 64).padEnd(65) + r.highlightFraction.toFixed(4).padEnd(15) + r.p99.toFixed(4) + flag);
}

const toDrop = results.filter(r => r.highlightFraction < 0.02);
console.log(`\nDrop: ${toDrop.length}`);

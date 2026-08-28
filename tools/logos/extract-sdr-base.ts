#!/usr/bin/env npx tsx
import sharp from "sharp";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const WIDTHS = [128, 256, 512, 1024] as const;
const QUALITY: Record<number, number> = { 128: 75, 256: 80, 512: 90, 1024: 90 };
const logosRoot = join(process.cwd(), "apps/web/public/logos");

const slugs = readdirSync(logosRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

for (const slug of slugs) {
  for (const w of WIDTHS) {
    const src = join(logosRoot, slug, `logo-gainmap-${w}.jpg`);
    const dest = join(logosRoot, slug, `logo-sdr-${w}.jpg`);
    if (!existsSync(src)) {
      console.log(`skip ${slug}/logo-gainmap-${w}.jpg (not found)`);
      continue;
    }
    await sharp(src).jpeg({ quality: QUALITY[w] }).toFile(dest);
    console.log(`wrote ${slug}/logo-sdr-${w}.jpg`);
  }
}
console.log("done");

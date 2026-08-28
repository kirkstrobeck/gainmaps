#!/usr/bin/env npx tsx
// One-shot: generate 2560 variants for specific slugs whose source is wide enough.
// Skips slugs where the source is too small to fill 2560px without upscaling.
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import sharp from "sharp";
import { encodeVariants } from "./encode-variants.ts";
import { PHOTOS } from "../../apps/web/lib/photos/catalog.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const publicRoot = join(repo, "apps/web/public/photos");
const SLUGS = [
  "landscape-photography-of-mountain-ranges-under-purple-and-pink",
  "photo-of-sea-wave-crashing-shore",
];

const USER_AGENT = "gainmaps-photos/1.0 (https://gainmaps.com; kirk@strobeck.com)";
const MAX_EDGE = 2560;
const BOOST = 1.0;

for (const slug of SLUGS) {
  const photo = PHOTOS.find(p => p.slug === slug);
  if (!photo) { console.log(`SKIP ${slug}: not in catalog`); continue; }
  const dir = join(publicRoot, slug);
  const g2560 = join(dir, "gainmap-2560.jpg");
  const s2560 = join(dir, "standard-2560.jpg");
  if (existsSync(g2560) && existsSync(s2560)) { console.log(`SKIP ${slug}: already has 2560`); continue; }

  const nativeMax = Math.max(photo.width, photo.height);
  if (nativeMax < MAX_EDGE) {
    console.log(`SKIP ${slug}: source ${nativeMax}px < ${MAX_EDGE} (would upscale)`);
    continue;
  }

  // Download from Unsplash CDN
  console.log(`Downloading ${slug}...`);
  const url = `https://images.unsplash.com/${photo.unsplashPhotoId}?auto=format&fit=max&w=${MAX_EDGE}&q=90`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${slug}`);
  const jpeg = Buffer.from(await response.arrayBuffer());

  // Decode to RGBA at max edge
  const { data, info } = await sharp(jpeg)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Encode only 2560 variant using encodeVariants (pass full-size source, it handles sizing)
  await encodeVariants(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), info.width, info.height, dir, BOOST);
  console.log(`DONE ${slug}: ${info.width}x${info.height}`);
}

console.log("gen-2560 complete");

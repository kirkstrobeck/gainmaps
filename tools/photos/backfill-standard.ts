#!/usr/bin/env npx tsx
// Gainmaps by Kirk Strobeck – https://gainmaps.com

/**
 * Backfill standard-<w>.jpg siblings for catalog photos from existing
 * gainmap-<w>.jpg files via `gainmap extract-sdr`. Does not re-download or
 * re-encode; gain map bytes are left untouched.
 *
 *   npx tsx tools/photos/backfill-standard.ts
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { PHOTO_WIDTHS } from "./encode-variants.ts";
import { PHOTOS } from "../../apps/web/lib/photos/catalog.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const publicRoot = join(repo, "apps/web/public/photos");
const CLI = resolve(repo, "packages/gainmap/dist/cli.js");

type Missing = { readonly slug: string; readonly width: number; readonly reason: string };

function extractOne(slug: string, width: number, missing: readonly Missing[]): readonly Missing {
  const dir = join(publicRoot, slug);
  const gainmapPath = join(dir, `gainmap-${width}.jpg`);
  if (!existsSync(gainmapPath)) {
    return [...missing, { slug, width, reason: "missing gainmap-" + width + ".jpg" }];
  }
  const tmpSdr = join(tmpdir(), `backfill-sdr-${slug}-${width}-${Date.now()}.jpg`);
  try {
    execFileSync(process.execPath, [
      CLI,
      "extract-sdr",
      gainmapPath,
      "-o",
      tmpSdr,
      "--force",
      "--no-update-check",
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [...missing, { slug, width, reason: "extract-sdr failed: " + message }];
  }
  mkdirSync(dir, { recursive: true });
  copyFileSync(tmpSdr, join(dir, `standard-${width}.jpg`));
  return missing;
}

function backfillSlug(slug: string, missing: readonly Missing[]): readonly Missing {
  return PHOTO_WIDTHS.reduce(
    (acc, width) => extractOne(slug, width, acc),
    missing,
  );
}

function main(): void {
  const missing = PHOTOS.reduce(
    (acc, photo) => backfillSlug(photo.slug, acc),
    [] as readonly Missing[],
  );
  const expected = PHOTOS.length * PHOTO_WIDTHS.length;
  process.stdout.write(
    "backfill-standard: " + PHOTOS.length + " slugs × " + PHOTO_WIDTHS.length +
      " widths = " + expected + " files" + String.fromCharCode(10),
  );
  if (missing.length === 0) {
    process.stdout.write("ok: all standard siblings written" + String.fromCharCode(10));
    return;
  }
  process.stdout.write("recorded " + missing.length + " missing/failed:" + String.fromCharCode(10));
  for (const item of missing) {
    process.stdout.write("  " + item.slug + " @" + item.width + ": " + item.reason + String.fromCharCode(10));
  }
}

main();

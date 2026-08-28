#!/usr/bin/env npx tsx
/**
 * Rewrite apps/web/lib/photos/catalog.ts in the local-file shape.
 * Membership comes from the committed PHOTOS array — this script does not
 * fetch Unsplash and does not add or remove photographs.
 * Run: npx tsx tools/photos/curate-photos.ts
 */
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PAGE_SIZE,
  PHOTOS,
  PHOTO_GALLERY_SIZES,
  PHOTO_HERO_SIZES,
  PHOTO_SRC_WIDTHS,
  type Photo,
} from "../../apps/web/lib/photos/catalog.ts";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../apps/web/lib/photos/catalog.ts");
const DEFAULT_WIDTH = PHOTO_SRC_WIDTHS[PHOTO_SRC_WIDTHS.length - 1];

function field(photo: Photo): string {
  return [
    `id: ${JSON.stringify(photo.id)}`,
    `slug: ${JSON.stringify(photo.slug)}`,
    `unsplashPhotoId: ${JSON.stringify(photo.unsplashPhotoId)}`,
    `photographer: ${JSON.stringify(photo.photographer)}`,
    `photographerUrl: ${JSON.stringify(photo.photographerUrl)}`,
    `photoUrl: ${JSON.stringify(photo.photoUrl)}`,
    `width: ${photo.width}`,
    `height: ${photo.height}`,
    `alt: ${JSON.stringify(photo.alt)}`,
  ].join(", ");
}

function catalogSource(): string {
  const widths = PHOTO_SRC_WIDTHS.join(", ");
  const entries = PHOTOS.map((photo) => `  { ${field(photo)} },`).join("\n");
  return `/**
 * Unsplash photographs for /photos. Both Standard and Ultra tiles are local
 * JPEGs under /photos/{slug}/ — standard-*.jpg (SDR base via \`gainmap extract-sdr\`)
 * and gainmap-*.jpg (Ultra HDR, boost 1.0 max). Responsive widths: ${widths}.
 *
 * Rebuild: npx tsx tools/photos/build-photos.ts
 */

export const PHOTO_SRC_WIDTHS = [${widths}] as const;

/** Gallery cards are ~384px at lg; keep this under 400 so srcset picks 400w at DPR 1. */
export const PHOTO_GALLERY_SIZES =
  ${JSON.stringify(PHOTO_GALLERY_SIZES)};

/** Hero photo column is ~716px at lg; 720px selects 800w instead of 1280w at DPR 1. */
export const PHOTO_HERO_SIZES = ${JSON.stringify(PHOTO_HERO_SIZES)};

export type Photo = {
  readonly id: string;
  readonly slug: string;
  /** images.unsplash.com filename, e.g. photo-1506905925346-21bda4d32df4 */
  readonly unsplashPhotoId: string;
  readonly photographer: string;
  readonly photographerUrl: string;
  readonly photoUrl: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
};

export const PAGE_SIZE = ${PAGE_SIZE};

export const PHOTOS: readonly Photo[] = [
${entries}
];

export function photoBySlug(slug: string): Photo | undefined {
  return PHOTOS.find((photo) => photo.slug === slug);
}

export function photoStandardSrc(photo: Photo, width: (typeof PHOTO_SRC_WIDTHS)[number] = ${DEFAULT_WIDTH}): string {
  return \`/photos/\${photo.slug}/standard-\${width}.jpg\`;
}

export function photoStandardSrcset(photo: Photo): string {
  return PHOTO_SRC_WIDTHS.map((w) => \`/photos/\${photo.slug}/standard-\${w}.jpg \${w}w\`).join(", ");
}

export function photoGainmapSrc(photo: Photo, width: (typeof PHOTO_SRC_WIDTHS)[number] = ${DEFAULT_WIDTH}): string {
  return \`/photos/\${photo.slug}/gainmap-\${width}.jpg\`;
}

export function photoGainmapSrcset(photo: Photo): string {
  return PHOTO_SRC_WIDTHS.map((w) => \`/photos/\${photo.slug}/gainmap-\${w}.jpg \${w}w\`).join(", ");
}

export function withUnsplashReferral(url: string): string {
  const join = url.includes("?") ? "&" : "?";
  return \`\${url}\${join}utm_source=gainmaps&utm_medium=referral\`;
}

export function photosPageCount(): number {
  return Math.ceil(PHOTOS.length / PAGE_SIZE);
}

export function photosForPage(page: number): readonly Photo[] {
  const total = photosPageCount();
  const current = Math.min(Math.max(page, 1), Math.max(total, 1));
  const start = (current - 1) * PAGE_SIZE;
  return PHOTOS.slice(start, start + PAGE_SIZE);
}

export function clampPhotoPage(page: number): number {
  const total = photosPageCount();
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), Math.max(total, 1));
}
`;
}

await writeFile(OUT, catalogSource(), "utf8");
console.log(`Wrote ${OUT} (${PHOTOS.length} photographs, local-file sources)`);

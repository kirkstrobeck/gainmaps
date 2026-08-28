import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";
import {
  PHOTOS,
  PHOTO_SRC_WIDTHS,
  PHOTO_STORAGE_BASE_URL,
  photoGainmapSrc,
  photoGainmapSrcset,
  photoStandardSrc,
  photoStandardSrcset,
} from "@/lib/photos/catalog";

const REPO_ROOT = join(process.cwd(), "../..");
const STORAGE_ORIGIN = "https://icquwwyymqnvhcpufxje.supabase.co";
const STORAGE_PREFIX = `${PHOTO_STORAGE_BASE_URL}/photos/`;

function trackedPublicPhotos(): readonly string[] {
  return execSync("git ls-files -z -- apps/web/public/photos", { cwd: REPO_ROOT })
    .toString()
    .split("\0")
    .filter(Boolean);
}

function widthsFrom(srcset: string): readonly number[] {
  return srcset.split(", ").map((entry) => Number(entry.match(/(\d+)w$/)?.[1]));
}

describe("remote photo storage parity", () => {
  it("does not track generated photo binaries in git", () => {
    expect(trackedPublicPhotos()).toEqual([]);
  });

  it("uses the Supabase static tenant prefix", () => {
    expect(PHOTO_STORAGE_BASE_URL).toBe(`${STORAGE_ORIGIN}/storage/v1/object/public/static/gainmaps.com`);
    expect(photoStandardSrc(PHOTOS[0]!).startsWith(STORAGE_PREFIX)).toBe(true);
    expect(photoGainmapSrc(PHOTOS[0]!).startsWith(STORAGE_PREFIX)).toBe(true);
  });

  it("keeps standard and gainmap files under matching remote slug paths", () => {
    for (const photo of PHOTOS) {
      expect(photoStandardSrc(photo, 400)).toBe(`${STORAGE_PREFIX}${photo.slug}/standard-400.jpg`);
      expect(photoGainmapSrc(photo, 400)).toBe(`${STORAGE_PREFIX}${photo.slug}/gainmap-400.jpg`);
    }
  });

  it("keeps standard and gainmap srcsets at matching width descriptors", () => {
    for (const photo of PHOTOS) {
      expect(widthsFrom(photoGainmapSrcset(photo))).toEqual(widthsFrom(photoStandardSrcset(photo)));
    }
  });

  it("still caps variants to the intrinsic photo width", () => {
    for (const photo of PHOTOS) {
      const expected = PHOTO_SRC_WIDTHS.filter((w) => w <= photo.width);
      expect(widthsFrom(photoStandardSrcset(photo))).toEqual(expected);
      expect(widthsFrom(photoGainmapSrcset(photo))).toEqual(expected);
    }
  });
});

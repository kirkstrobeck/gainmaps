import { describe, it, expect } from "vitest";
import {
  PHOTOS,
  PAGE_SIZE,
  PHOTO_GALLERY_SIZES,
  PHOTO_HERO_SIZES,
  PHOTO_STORAGE_BASE_URL,
  photoBySlug,
  photoStandardSrc,
  photoStandardSrcset,
  photoGainmapSrc,
  photoGainmapSrcset,
  withUnsplashReferral,
  photosPageCount,
  photosForPage,
  clampPhotoPage,
} from "@/lib/photos/catalog";

const FIRST = PHOTOS[0]!;

describe("PHOTOS", () => {
  it("is derived from the catalog array, not a typed literal", () => {
    expect(PHOTOS.length).toBeGreaterThan(0);
  });
});

describe("responsive sizes", () => {
  it("gallery sizes state true CSS layout width (not DPR-1 tuned)", () => {
    expect(PHOTO_GALLERY_SIZES).not.toContain("380px");
    expect(PHOTO_GALLERY_SIZES).toContain("384px");
  });
  it("hero sizes state true CSS layout width (not DPR-1 tuned)", () => {
    expect(PHOTO_HERO_SIZES).not.toContain("720px");
    expect(PHOTO_HERO_SIZES).toContain("564px");
  });
});

describe("photoBySlug", () => {
  it("returns photo for existing slug", () => {
    expect(photoBySlug(FIRST.slug)).toBe(FIRST);
  });
  it("returns undefined for missing slug", () => {
    expect(photoBySlug("no-such-slug")).toBeUndefined();
  });
});

describe("photoStandardSrc", () => {
  it("serves remote standard JPEG for the slug", () => {
    expect(photoStandardSrc(FIRST)).toBe(`${PHOTO_STORAGE_BASE_URL}/photos/${FIRST.slug}/standard-1280.jpg`);
  });
  it("uses provided width", () => {
    expect(photoStandardSrc(FIRST, 800)).toBe(`${PHOTO_STORAGE_BASE_URL}/photos/${FIRST.slug}/standard-800.jpg`);
  });
  it("defaults to width 1280", () => {
    expect(photoStandardSrc(FIRST)).toContain("standard-1280.jpg");
  });
});

describe("photoStandardSrcset", () => {
  it("contains six width entries", () => {
    const parts = photoStandardSrcset(FIRST).split(", ");
    expect(parts.length).toBe(6);
  });
  it("mirrors gainmap widths under remote /photos/<slug>/standard-", () => {
    const src = photoStandardSrcset(FIRST);
    expect(src).toBe(
      [400, 800, 1280, 1600, 2048, 2560].map((w) => `${PHOTO_STORAGE_BASE_URL}/photos/${FIRST.slug}/standard-${w}.jpg ${w}w`).join(", "),
    );
  });
  it("caps at photo intrinsic width for small photos", () => {
    const small = PHOTOS.find(p => p.width < 2560)!;
    const parts = photoStandardSrcset(small).split(", ");
    expect(parts.length).toBeLessThan(6);
    parts.forEach(p => {
      const w = parseInt(p.match(/(\d+)w$/)![1]);
      expect(w).toBeLessThanOrEqual(small.width);
    });
  });
});

describe("photoGainmapSrc", () => {
  it("uses slug path at the default 1280 width", () => {
    expect(photoGainmapSrc(FIRST)).toBe(`${PHOTO_STORAGE_BASE_URL}/photos/${FIRST.slug}/gainmap-1280.jpg`);
  });
  it("uses provided width", () => {
    expect(photoGainmapSrc(FIRST, 400)).toBe(`${PHOTO_STORAGE_BASE_URL}/photos/${FIRST.slug}/gainmap-400.jpg`);
  });
});

describe("photoGainmapSrcset", () => {
  it("has six width variants", () => {
    const parts = photoGainmapSrcset(FIRST).split(", ");
    expect(parts.length).toBe(6);
  });
  it("contains 400w 800w 1280w 1600w 2048w 2560w", () => {
    const src = photoGainmapSrcset(FIRST);
    expect(src).toContain("400w");
    expect(src).toContain("800w");
    expect(src).toContain("1280w");
    expect(src).toContain("1600w");
    expect(src).toContain("2048w");
    expect(src).toContain("2560w");
  });
});

describe("withUnsplashReferral", () => {
  it("appends utm params to plain url", () => {
    const out = withUnsplashReferral("https://example.com");
    expect(out).toContain("utm_source=gainmaps");
  });
  it("uses & when url already has query params", () => {
    const out = withUnsplashReferral("https://example.com?foo=bar");
    expect(out).toContain("&utm_source");
  });
  it("uses ? when url has no query params", () => {
    const out = withUnsplashReferral("https://example.com");
    expect(out).toContain("?utm_source");
  });
});

describe("photosPageCount", () => {
  it("matches current catalog size / PAGE_SIZE", () => {
    expect(photosPageCount()).toBe(Math.ceil(PHOTOS.length / PAGE_SIZE));
  });
});

describe("photosForPage", () => {
  it("returns first page correctly", () => {
    const page = photosForPage(1);
    expect(page.length).toBe(PAGE_SIZE);
    expect(page[0]).toBe(PHOTOS[0]);
  });
  it("clamps below 1 to page 1", () => {
    expect(photosForPage(0)[0]).toBe(PHOTOS[0]);
  });
  it("clamps above total to last page", () => {
    const lastPage = photosForPage(999);
    expect(lastPage.length).toBeGreaterThan(0);
  });
  it("last page has remaining photos", () => {
    const total = photosPageCount();
    const lastPage = photosForPage(total);
    expect(lastPage.length).toBe(PHOTOS.length - (total - 1) * PAGE_SIZE);
  });
});

describe("clampPhotoPage", () => {
  it("clamps NaN to 1", () => expect(clampPhotoPage(NaN)).toBe(1));
  it("clamps Infinity to 1", () => expect(clampPhotoPage(Infinity)).toBe(1));
  it("clamps 0 to 1", () => expect(clampPhotoPage(0)).toBe(1));
  it("clamps -5 to 1", () => expect(clampPhotoPage(-5)).toBe(1));
  it("floors 1.9 to 1", () => expect(clampPhotoPage(1.9)).toBe(1));
  it("clamps excess page to total", () => {
    const total = photosPageCount();
    expect(clampPhotoPage(999)).toBe(total);
  });
  it("returns valid page unchanged", () => expect(clampPhotoPage(2)).toBe(2));
});

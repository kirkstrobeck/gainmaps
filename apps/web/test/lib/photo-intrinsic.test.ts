import { describe, it, expect } from "vitest";
import { PHOTOS } from "@/lib/photos/catalog";
import { PHOTO_INTRINSIC_BY_SLUG } from "@/lib/photos/intrinsic-by-slug";
import { photoIntrinsicSize } from "@/lib/photos/photo-intrinsic";

describe("photoIntrinsicSize", () => {
  it("returns shipped long-edge-1280 size for every catalog photo", () => {
    for (const photo of PHOTOS) {
      expect(photoIntrinsicSize(photo)).toEqual(PHOTO_INTRINSIC_BY_SLUG[photo.slug]);
    }
  });

  it("throws when the slug is missing from the shipped map", () => {
    expect(() =>
      photoIntrinsicSize({
        ...PHOTOS[0]!,
        slug: "no-such-shipped-photo",
      }),
    ).toThrow(/missing intrinsic size/);
  });
});

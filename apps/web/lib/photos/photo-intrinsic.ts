import type { Photo } from "@/lib/photos/catalog";
import { PHOTO_INTRINSIC_BY_SLUG } from "@/lib/photos/intrinsic-by-slug";

/** Intrinsic width/height of the shipped long-edge-1280 JPEG pair for a photo. */
export function photoIntrinsicSize(photo: Photo): { width: number; height: number } {
  const size = PHOTO_INTRINSIC_BY_SLUG[photo.slug];
  if (!size) {
    throw new Error(`missing intrinsic size for photo slug: ${photo.slug}`);
  }
  return size;
}

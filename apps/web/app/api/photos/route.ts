import { NextResponse } from "next/server";
import { PHOTOS, photoStandardSrc, photoGainmapSrc } from "@/lib/photos/catalog";
import { jsonOk } from "@/lib/api-response";

export async function GET(): Promise<NextResponse> {
  const data = PHOTOS.map((photo) => ({
    id: photo.id,
    slug: photo.slug,
    alt: photo.alt,
    width: photo.width,
    height: photo.height,
    photographer: photo.photographer,
    photographerUrl: photo.photographerUrl,
    photoUrl: photo.photoUrl,
    standardSrc: photoStandardSrc(photo, 1280),
    gainmapSrc: photoGainmapSrc(photo),
  }));
  return jsonOk(data);
}

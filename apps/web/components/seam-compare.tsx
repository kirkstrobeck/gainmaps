"use client";

import { UltraWord } from "@/components/ultra-word";
import { SeamInstrument } from "@/components/seam-instrument";
import { SeamLayerImg } from "@/components/seam-layer-img";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";
import type { Photo } from "@/lib/photos/catalog";
import { photoGainmapSrc, photoGainmapSrcset, photoStandardSrc, photoStandardSrcset } from "@/lib/photos/catalog";
import { photoIntrinsicSize } from "@/lib/photos/photo-intrinsic";

const DEFAULT_STD_SIZES = "(min-width: 1280px) calc(100vw - 460px), 100vw";

export function SeamComparePhoto({
  photo,
  width,
  height,
  className,
  priority = false,
  sizes = DEFAULT_STD_SIZES,
  deferUltra = false,
}: {
  photo: Photo;
  width?: number | string;
  height?: number | string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  deferUltra?: boolean;
}) {
  const stdSrc = photoStandardSrc(photo, 400);
  const gainSrc = photoGainmapSrc(photo, 400);
  const intrinsic = photoIntrinsicSize(photo);
  const loading: "lazy" | "eager" = priority ? "eager" : "lazy";
  const fetchPriority: "high" | "low" = priority ? "high" : "low";

  return (
    <SeamInstrument
      width={width}
      height={height}
      className={className}
      sdr={
        <SeamLayerImg
          src={stdSrc}
          srcSet={photoStandardSrcset(photo)}
          sizes={sizes}
          alt={`${photo.alt}, Standard`}
          width={intrinsic.width}
          height={intrinsic.height}
          className="inst-img"
          loading={loading}
          fetchPriority={fetchPriority}
        />
      }
      ultra={
        <SeamLayerImg
          src={gainSrc}
          srcSet={photoGainmapSrcset(photo)}
          sizes={sizes}
          alt={`${photo.alt}, Ultra`}
          width={intrinsic.width}
          height={intrinsic.height}
          className="inst-img gainmap-image"
          loading={loading}
          fetchPriority={fetchPriority}
          defer={deferUltra}
        />
      }
    />
  );
}

export function SeamCompareType({
  typeClassName = "font-display font-bold [font-size:clamp(3rem,28vw,8rem)]",
  intensity = TEXT_ULTRA_INTENSITY,
  width,
  height,
  className,
}: {
  typeClassName?: string;
  intensity?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  return (
    <SeamInstrument
      width={width}
      height={height}
      className={className}
      sdrLayerClassName="inst-type-sdr-layer"
      sdr={<span className={`${typeClassName} inst-type-std`}>Ultra</span>}
      ultra={
        <UltraWord
          text="Ultra"
          typeClassName={typeClassName}
          intensity={intensity}
        />
      }
    />
  );
}

"use client";

import { SeamInstrument } from "@/components/seam-instrument";
import { SeamLayerImg } from "@/components/seam-layer-img";

type ImageComparePairProps = {
  src: string;
  sdrSrc?: string;
  alt: string;
  caption?: React.ReactNode;
  srcSet?: string;
  sdrSrcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
};

export function ImageComparePair({ src, sdrSrc, alt, caption, srcSet, sdrSrcSet, sizes, width = 512, height = 512 }: ImageComparePairProps) {
  const resolvedSizes = sizes ?? "100vw";
  return (
    <figure>
      <SeamInstrument
        width="100%"
        className="h-64"
        sdr={
          <SeamLayerImg
            src={sdrSrc ?? src}
            srcSet={sdrSrcSet ?? srcSet ?? ""}
            sizes={resolvedSizes}
            alt={`${alt}, Standard`}
            width={width}
            height={height}
            className="inst-img"
            loading="eager"
            fetchPriority="high"
          />
        }
        ultra={
          <SeamLayerImg
            src={src}
            srcSet={srcSet ?? ""}
            sizes={resolvedSizes}
            alt={`${alt}, Ultra`}
            width={width}
            height={height}
            className="inst-img gainmap-image"
            loading="eager"
            fetchPriority="high"
          />
        }
      />
      {caption ? (
        <figcaption className="mt-4 text-sm leading-6 text-[var(--muted)]">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

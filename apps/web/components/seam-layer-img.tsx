"use client";

import { useRef } from "react";
import { useNearViewport } from "@/lib/near-viewport";

export function SeamLayerImg({
  src,
  srcSet,
  sizes,
  alt,
  width,
  height,
  loading,
  fetchPriority,
  className,
  defer = false,
}: {
  src: string;
  srcSet: string;
  sizes: string;
  alt: string;
  width: number;
  height: number;
  loading: "lazy" | "eager";
  fetchPriority: "high" | "low";
  className: string;
  defer?: boolean;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const near = useNearViewport(ref, defer);
  const active = !defer || near;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={active ? src : undefined}
      srcSet={active ? srcSet : undefined}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      draggable={false}
    />
  );
}

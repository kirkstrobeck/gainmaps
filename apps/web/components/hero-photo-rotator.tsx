"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { PhotoCredit } from "@/components/photo-pair";
import { SeamComparePhoto } from "@/components/seam-compare";
import {
  PHOTO_HERO_SIZES,
  photoGainmapSrc,
  photoGainmapSrcset,
  photoStandardSrc,
  photoStandardSrcset,
  type Photo,
} from "@/lib/photos/catalog";

const ROTATION_MS = 7000;
const RING_RADIUS = 14;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type Props = {
  initialPhoto: Photo;
  photos?: readonly Photo[];
  className?: string;
  photoClassName?: string;
  priority?: boolean;
  sizes?: string;
};

function uniquePhotos(photos: readonly Photo[]): Photo[] {
  const seen = new Set<string>();
  return photos.filter((photo) => {
    if (seen.has(photo.slug)) return false;
    seen.add(photo.slug);
    return true;
  });
}

function preloadImage(src: string, srcSet: string, sizes: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    img.onload = finish;
    img.onerror = finish;
    img.decoding = "async";
    img.srcset = srcSet;
    img.sizes = sizes;
    img.src = src;

    if (typeof img.decode === "function") {
      void img.decode().then(finish, finish);
    }
    if (img.complete) finish();
  });
}

function preloadPhoto(photo: Photo, sizes: string): Promise<void> {
  return Promise.all([
    preloadImage(photoStandardSrc(photo, 1280), photoStandardSrcset(photo), sizes),
    preloadImage(photoGainmapSrc(photo, 1280), photoGainmapSrcset(photo), sizes),
  ]).then(() => undefined);
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return reduced;
}

export function HeroPhotoRotator({
  initialPhoto,
  photos,
  className,
  photoClassName,
  priority = false,
  sizes = PHOTO_HERO_SIZES,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const readySlugRef = useRef<string | null>(null);
  const reducedMotion = useReducedMotion();
  const candidates = useMemo(() => uniquePhotos([initialPhoto].concat(photos ?? [])), [initialPhoto, photos]);
  const [index, setIndex] = useState(0);
  const [inViewport, setInViewport] = useState(false);
  const [readySlug, setReadySlug] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const currentPhoto = candidates[index] ?? initialPhoto;
  const nextIndex = candidates.length > 1 ? (index + 1) % candidates.length : index;
  const nextPhoto = candidates[nextIndex] ?? null;
  const running = inViewport && !reducedMotion && candidates.length > 1 && nextPhoto != null;

  useEffect(() => {
    setIndex(0);
    setProgress(0);
  }, [initialPhoto.slug]);

  useEffect(() => {
    readySlugRef.current = readySlug;
  }, [readySlug]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setInViewport(Boolean(entry?.isIntersecting));
    }, { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setReadySlug(null);
    if (!running || !nextPhoto) return;

    let cancelled = false;
    void preloadPhoto(nextPhoto, sizes).then(() => {
      if (!cancelled) setReadySlug(nextPhoto.slug);
    });

    return () => {
      cancelled = true;
    };
  }, [nextPhoto, running, sizes]);

  useEffect(() => {
    if (!running || !nextPhoto) {
      setProgress(0);
      return;
    }

    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (start === 0) start = now;
      const nextProgress = Math.min(1, (now - start) / ROTATION_MS);
      setProgress(nextProgress);

      if (nextProgress >= 1 && readySlugRef.current === nextPhoto.slug) {
        setIndex(nextIndex);
        return;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, nextPhoto, nextIndex]);

  const ringOffset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <div ref={rootRef} className={className}>
      <div className="relative">
        <SeamComparePhoto
          photo={currentPhoto}
          width="100%"
          className={photoClassName}
          priority={priority}
          sizes={sizes}
        />
        {candidates.length > 1 && !reducedMotion ? (
          <div className="pointer-events-none absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/55 shadow-[0_1px_8px_rgba(0,0,0,0.24)] backdrop-blur-sm">
            <svg aria-label="Photo rotation progress" className="size-6" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r={RING_RADIUS} stroke="rgba(255,255,255,0.28)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r={RING_RADIUS}
                stroke="var(--accent)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                transform="rotate(-90 18 18)"
              />
            </svg>
          </div>
        ) : null}
      </div>
      <PhotoCredit photo={currentPhoto} />
    </div>
  );
}

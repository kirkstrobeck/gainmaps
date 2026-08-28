import { HeroPhotoRotator } from "@/components/hero-photo-rotator";
import { SeamCompareType } from "@/components/seam-compare";
import { UltraWord } from "@/components/ultra-word";
import type { Photo } from "@/lib/photos/catalog";
import {
  PHOTO_HERO_SIZES,
  photoGainmapSrc,
  photoGainmapSrcset,
  photoStandardSrc,
  photoStandardSrcset,
} from "@/lib/photos/catalog";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";
import { cn } from "@/lib/utils";

const H1_CLASS = "font-display text-[46px] font-[640] leading-[1.03] tracking-normal [font-variation-settings:'wdth'_100] lg:text-[78px]";
const TYPE_CLASS = "font-display font-bold [font-size:clamp(3rem,28vw,8rem)]";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export function HeroSection({ comparePhoto, rotationPhotos = [comparePhoto], id }: { comparePhoto: Photo; rotationPhotos?: readonly Photo[]; id?: string }) {
  const stdSrc1280 = photoStandardSrc(comparePhoto, 1280);
  return (
    <section aria-label="Hero" id={id}>
      {/* React 19 hoists these <link>s to <head>, starting fetches early */}
      <link
        rel="preload"
        as="image"
        href={stdSrc1280}
        imageSrcSet={photoStandardSrcset(comparePhoto)}
        imageSizes={PHOTO_HERO_SIZES}
        // @ts-ignore - fetchPriority is valid but typings lag
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href={photoGainmapSrc(comparePhoto)}
        imageSrcSet={photoGainmapSrcset(comparePhoto)}
        imageSizes={PHOTO_HERO_SIZES}
        // @ts-ignore
        fetchPriority="high"
      />
      {/*
        Mobile: flex-col with order properties so photo sits between actions and type.
        Desktop: 2-col grid, left groups span 3 rows with stretch, photo col 2 spans all.
      */}
      <div className={cn(
        "flex flex-col gap-4 px-4 pt-6 sm:px-8",
        "lg:grid lg:grid-cols-[1fr_380px] lg:grid-rows-[auto_auto_1fr] lg:gap-x-[56px] lg:gap-y-8 lg:px-16 lg:pt-10",
      )}>

        {/* Group 1: eyebrow, h1, deck */}
        <div className="order-2 grid gap-4 lg:order-none lg:col-start-2 lg:row-start-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
            Brighter than white
          </p>
          <h1 className={`${H1_CLASS} text-balance text-[var(--foreground)]`}>
            <UltraWord text="Gainmaps" typeClassName={H1_CLASS} intensity={TEXT_ULTRA_INTENSITY} />
          </h1>
          <p className="max-w-[31ch] text-[17px] leading-[1.55] text-[var(--muted)]">
            The original, gain map encoded. Standard reads the SDR base. Ultra lifts the highlights.
          </p>
        </div>

        {/* Group 2: actions */}
        <div className="order-3 flex flex-wrap items-center gap-3 lg:order-none lg:col-start-2 lg:row-start-2 lg:self-center">
          <a
            href="/convert"
            className={cn(
              "inline-flex h-11 items-center rounded-[var(--radius)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:opacity-90",
              FOCUS,
            )}
          >
            Convert an image
          </a>
        </div>

        {/* Photo instrument — col 2 spans all rows on desktop, order 3 on mobile */}
        <HeroPhotoRotator
          initialPhoto={comparePhoto}
          photos={rotationPhotos}
          className="order-1 grid content-start gap-2 lg:order-none lg:col-start-1 lg:row-span-3 lg:row-start-1"
          photoClassName="h-[234px] lg:h-[596px]"
          priority
          sizes={PHOTO_HERO_SIZES}
        />

        {/* Group 3: type instrument */}
        <div className="order-4 grid gap-3 lg:order-none lg:col-start-2 lg:row-start-3 lg:self-end">
          <hr className="border-[var(--border)]" />
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
            Type
          </p>
          <SeamCompareType
            typeClassName={TYPE_CLASS}
            intensity={TEXT_ULTRA_INTENSITY}
            width="100%"
            className="h-[108px] lg:h-[132px]"
          />
          <p className="hidden text-xs text-[var(--muted)] lg:block">
            Same text, same display — left is SDR white, right is Ultra.
          </p>
        </div>
      </div>
    </section>
  );
}

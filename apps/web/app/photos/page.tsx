import type { Metadata } from "next";
import { preload } from "react-dom";
import { ArrowBackIcon as ArrowLeftFilled, ArrowForwardIcon as ArrowRightFilled } from "@/components/icons";
import { UltraWord } from "@/components/ultra-word";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";

import { PageChrome } from "@/components/page-chrome";
import { PhotoCredit } from "@/components/photo-pair";
import { SeamComparePhoto } from "@/components/seam-compare";
import { UltraIcon } from "@/components/ultra-icon";
import {
  clampPhotoPage,
  PAGE_SIZE,
  PHOTOS,
  PHOTO_GALLERY_SIZES,
  photoGainmapSrc,
  photoGainmapSrcset,
  photoStandardSrc,
  photoStandardSrcset,
  photosForPage,
  photosPageCount,
  type Photo,
} from "@/lib/photos/catalog";

export const metadata: Metadata = {
  title: "Photos · Gainmaps",
  description: `${PHOTOS.length} Unsplash photographs, Standard SDR next to the same frame encoded as an Ultra HDR gain map.`,
  alternates: { canonical: "/photos" },
  openGraph: { type: "website", url: "/photos" },
};

type Search = { page?: string | string[] };

export default async function Base({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const page = pageFromSearch(await searchParams);
  const photos = photosForPage(page);
  const totalPages = photosPageCount();
  const firstPhoto = photos[0];
  /* v8 ignore next */
  if (firstPhoto) {
    preload(photoStandardSrc(firstPhoto), {
      as: "image",
      fetchPriority: "high",
      imageSrcSet: photoStandardSrcset(firstPhoto),
      imageSizes: PHOTO_GALLERY_SIZES,
    });
    preload(photoGainmapSrc(firstPhoto), {
      as: "image",
      fetchPriority: "high",
      imageSrcSet: photoGainmapSrcset(firstPhoto),
      imageSizes: PHOTO_GALLERY_SIZES,
    });
  }

  return (
    <main>
      <PageChrome />
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <header className="border-b border-[var(--border)] pb-10">
          <h1 className="font-display text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl">
            <UltraWord text="Photos" typeClassName="font-display text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl" intensity={TEXT_ULTRA_INTENSITY} />
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            {PHOTOS.length} Unsplash photographs. Standard SDR beside the same frame encoded as an{" "}
            <strong className="font-medium text-[var(--foreground)]">Ultra</strong> HDR gain map.
          </p>
        </header>

        <ul className="mt-10 grid list-none grid-cols-1 gap-8 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="photo-card">
              <PhotoCard photo={photo} priority={index < 3 ? true : undefined} deferUltra={index >= 3} />
            </li>
          ))}
        </ul>

        <Pagination page={page} totalPages={totalPages} />
      </div>
    </main>
  );
}

function PhotoCard({ photo, priority, deferUltra }: { photo: Photo; priority?: boolean; deferUltra?: boolean }) {
  return (
    <article className="grid gap-3">
      <SeamComparePhoto
        photo={photo}
        width="100%"
        className="h-[220px]"
        priority={priority}
        deferUltra={deferUltra}
        sizes={PHOTO_GALLERY_SIZES}
      />
      <div className="flex items-center justify-between gap-2">
        <PhotoCredit photo={photo} />
        <a
          href={`/photos/${photo.slug}`}
          className="shrink-0 text-xs font-medium text-[var(--accent)] transition hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          aria-label={`View ${photo.alt}`}
        >
          View →
        </a>
      </div>
    </article>
  );
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  return (
    <nav
      aria-label="Photo pages"
      className="mt-12 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-6 text-sm"
    >
      <PageLink page={previousPage(page)} direction="Previous" icon="left" />
      <p className="text-[var(--muted)]">
        {page} <span className="text-[var(--border)]">/</span> {totalPages}
        <span className="ml-3 hidden text-xs sm:inline">
          · {PAGE_SIZE} per page
        </span>
      </p>
      <PageLink page={nextPage(page, totalPages)} direction="Next" icon="right" />
    </nav>
  );
}

function PageLink({
  page,
  direction,
  icon,
}: {
  page: number | undefined;
  direction: string;
  icon: "left" | "right";
}) {
  if (page == null) return <span className="w-24" />;

  const href = page === 1 ? "/photos" : `/photos?page=${page}`;
  const cls =
    "inline-flex items-center gap-2 rounded-[var(--radius)] px-3 py-1.5 text-[var(--muted)] transition hover:bg-[color-mix(in_srgb,var(--accent)_7%,transparent)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

  if (icon === "left") {
    return (
      <a className={cls} href={href}>
        <UltraIcon size={14}>
          <ArrowLeftFilled />
        </UltraIcon>
        {direction}
      </a>
    );
  }

  return (
    <a className={cls} href={href}>
      {direction}
      <UltraIcon size={14}>
        <ArrowRightFilled />
      </UltraIcon>
    </a>
  );
}

function pageFromSearch(params: Search): number {
  const raw = Array.isArray(params.page) ? params.page[0] : params.page;
  return clampPhotoPage(Number(raw ?? "1"));
}

function previousPage(page: number): number | undefined {
  if (page <= 1) return undefined;
  return page - 1;
}

function nextPage(page: number, totalPages: number): number | undefined {
  if (page >= totalPages) return undefined;
  return page + 1;
}

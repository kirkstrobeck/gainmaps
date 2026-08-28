import {
  photoGainmapSrc,
  photoGainmapSrcset,
  photoStandardSrc,
  photoStandardSrcset,
  withUnsplashReferral,
  type Photo,
} from "@/lib/photos/catalog";
import { photoIntrinsicSize } from "@/lib/photos/photo-intrinsic";

type PhotoPairSize = "card" | "detail";

const TILE_SIZES: Record<PhotoPairSize, string> = {
  card: "(max-width: 640px) 50vw, (max-width: 1280px) 30vw, 22vw",
  detail: "(max-width: 640px) 100vw, 50vw",
};

const FRAME: Record<PhotoPairSize, string> = {
  card: "aspect-[4/3]",
  detail: "aspect-[3/2] sm:aspect-[4/3]",
};

/**
 * Standard vs Ultra pair for a catalog photo.
 *
 * Both sides use raw <img> (no Next.js optimizer) so neither goes through an
 * extra JPEG re-encode — a fair pixel-to-pixel comparison. The optimizer would
 * strip the gain map from the Ultra side and add compression loss to the SDR side.
 */
export function PhotoPair({ photo, size, priority = false }: { photo: Photo; size: PhotoPairSize; priority?: boolean }) {
  const { width, height } = photoIntrinsicSize(photo);
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      <PhotoTile
        src={photoStandardSrc(photo)}
        srcSet={photoStandardSrcset(photo)}
        imgWidth={width}
        imgHeight={height}
        alt={`${photo.alt}, Standard`}
        label="Standard"
        size={size}
        priority={priority}
      />
      <PhotoTile
        src={photoGainmapSrc(photo)}
        srcSet={photoGainmapSrcset(photo)}
        imgWidth={width}
        imgHeight={height}
        alt={`${photo.alt}, Ultra`}
        label="Ultra"
        size={size}
        priority={priority}
      />
    </div>
  );
}

export function PhotoCredit({ photo }: { photo: Photo }) {
  return (
    <p className="text-xs leading-5 text-[var(--muted)]">
      Photo by{" "}
      <a
        className="text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-2 transition hover:text-[var(--accent)]"
        href={withUnsplashReferral(photo.photographerUrl)}
        rel="noreferrer"
        target="_blank"
      >
        {photo.photographer}
      </a>{" "}
      on{" "}
      <a
        className="text-[var(--foreground)] underline decoration-[var(--border)] underline-offset-2 transition hover:text-[var(--accent)]"
        href={withUnsplashReferral("https://unsplash.com")}
        rel="noreferrer"
        target="_blank"
      >
        Unsplash
      </a>
      {" · "}
      <a
        className="underline decoration-[var(--border)] underline-offset-2 transition hover:text-[var(--accent)]"
        href={withUnsplashReferral(photo.photoUrl)}
        rel="noreferrer"
        target="_blank"
      >
        Original
      </a>
    </p>
  );
}

function PhotoTile({
  src,
  srcSet,
  imgWidth,
  imgHeight,
  alt,
  label,
  size,
  priority,
}: {
  src: string;
  srcSet?: string;
  imgWidth?: number;
  imgHeight?: number;
  alt: string;
  label: string;
  size: PhotoPairSize;
  priority?: boolean;
}) {
  return (
    <figure className="m-0 grid gap-0">
      <div
        className={`relative overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] ${FRAME[size]}`}
      >
        <PhotoImage src={src} srcSet={srcSet} imgWidth={imgWidth} imgHeight={imgHeight} alt={alt} size={size} priority={priority} />
      </div>
      {/* Always-visible label — accessible at both card and detail sizes */}
      <figcaption className="mt-1.5 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
      </figcaption>
    </figure>
  );
}

function PhotoImage({
  src,
  srcSet,
  imgWidth,
  imgHeight,
  alt,
  size,
  priority,
}: {
  src: string;
  srcSet?: string;
  imgWidth?: number;
  imgHeight?: number;
  alt: string;
  size: PhotoPairSize;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={srcSet}
      sizes={TILE_SIZES[size]}
      width={imgWidth}
      height={imgHeight}
      alt={alt}
      className="gainmap-image absolute inset-0 size-full object-cover"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}

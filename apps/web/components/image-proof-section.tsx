import { ImageComparePair } from "@/components/compare-pair";
import { SeamComparePhoto } from "@/components/seam-compare";
import { companyBySlug, COMPANIES } from "@/lib/logos/companies";
import type { Photo } from "@/lib/photos/catalog";
import { PHOTOS } from "@/lib/photos/catalog";

function logoGainmapSrcset(slug: string): string {
  return [128, 256, 512, 1024].map(w => `/logos/${slug}/logo-gainmap-${w}.jpg ${w}w`).join(", ");
}

function logoSdrSrcsetFor(slug: string): string {
  return [128, 256, 512, 1024].map(w => `/logos/${slug}/logo-sdr-${w}.jpg ${w}w`).join(", ");
}

function logoAlt(slug: string, fallback: string): string {
  /* v8 ignore next */
  return `${companyBySlug(slug)?.name ?? fallback} logo gain map image`;
}

type Props = {
  photoPeek: readonly Photo[];
};

export function ImageProofSection({ photoPeek }: Props) {
  return (
    <>
      {/* ── Logos ── */}
      <section className="border-t border-[var(--border)] pt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">{COMPANIES.length} brand logos</h2>
          <a
            href="/logos"
            className="text-sm font-medium text-[var(--accent)] transition hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Browse all {COMPANIES.length} logos →
          </a>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <ImageComparePair
            src="/logos/instagram/logo-gainmap.jpg"
            srcSet={logoGainmapSrcset("instagram")}
            sdrSrc="/logos/instagram/logo-sdr.jpg"
            sdrSrcSet={logoSdrSrcsetFor("instagram")}
            sizes="(max-width: 640px) 224px, 256px"
            alt={logoAlt("instagram", "Instagram")}
          />
          <ImageComparePair
            src="/logos/lego/logo-gainmap.jpg"
            srcSet={logoGainmapSrcset("lego")}
            sdrSrc="/logos/lego/logo-sdr.jpg"
            sdrSrcSet={logoSdrSrcsetFor("lego")}
            sizes="(max-width: 640px) 224px, 256px"
            alt={logoAlt("lego", "LEGO")}
          />
          <ImageComparePair
            src="/logos/american-express/logo-gainmap.jpg"
            srcSet={logoGainmapSrcset("american-express")}
            sdrSrc="/logos/american-express/logo-sdr.jpg"
            sdrSrcSet={logoSdrSrcsetFor("american-express")}
            sizes="(max-width: 640px) 224px, 256px"
            alt={logoAlt("american-express", "American Express")}
          />
        </div>
      </section>

      {/* ── Photos ── */}
      <section className="border-t border-[var(--border)] pt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">{PHOTOS.length} photographs</h2>
          <a
            href="/photos"
            className="text-sm font-medium text-[var(--accent)] transition hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Browse all {PHOTOS.length} photos →
          </a>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {photoPeek.map((p) => (
            <div key={p.id}>
              <SeamComparePhoto
                photo={p}
                width="100%"
                className="h-[200px]"
                sizes="(max-width: 768px) 33vw, 240px"
              />
              <a
                href={`/photos/${p.slug}`}
                className="mt-2 block truncate text-xs text-[var(--muted)] transition hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                aria-label={p.alt}
              >
                {p.alt}
              </a>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/* Ultra mode by Kirk Strobeck */
export const dynamic = "force-dynamic";
import { ThumbUpIcon } from "@/components/icons";
import { HomeDropZone } from "@/components/home-drop-zone";
import { SiteNav } from "@/components/site-nav";
import { UltraIcon } from "@/components/ultra-icon";
import { PHOTOS } from "@/lib/photos/catalog";
import { PRODUCT_HUNT_URL } from "@/lib/product-hunt";
import { HeroSection } from "@/components/hero-section";
import { ImageProofSection } from "@/components/image-proof-section";
import { InstallSwitcher } from "@/components/install-switcher";
import { UltraSkillCard } from "@/components/ultra-skill-card";
import { headers, cookies } from "next/headers";
import { shuffle } from "@/lib/shuffle";

type Search = { [key: string]: string | string[] | undefined };

export default async function Base({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await searchParams;
  const reqHeaders = await headers();
  const heroSlug = reqHeaders.get("x-hero-photo-slug");
  const cookieStore = await cookies();
  const lastPhotoSlug = heroSlug ?? cookieStore.get("last-photo")?.value;
  const pool = lastPhotoSlug ? PHOTOS.filter((p) => p.slug !== lastPhotoSlug) : PHOTOS;
  const foundBySlug = heroSlug ? PHOTOS.find((p) => p.slug === heroSlug) : null;
  const poolPhoto = pool[Math.floor(Math.random() * pool.length)];
  /* v8 ignore next */
  const comparePhoto = foundBySlug ?? poolPhoto ?? PHOTOS[0]!;
  const available = PHOTOS.filter((p) => p !== comparePhoto);
  const shuffledAvailable = shuffle(available);
  const PHOTO_PEEK = shuffledAvailable.slice(0, 3);
  const HERO_ROTATION = [comparePhoto, ...shuffledAvailable.slice(0, 8)];

  return (
    <main>
      <meta name="description" content="Convert photos to HDR gain map images instantly in your browser. Local and private — no upload, no server." />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-[var(--radius)] focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-[var(--accent-foreground)]">
        Skip to content
      </a>
      <SiteNav />

      {/* ── Above the fold: Hero with photo ── */}
      <HeroSection comparePhoto={comparePhoto} rotationPhotos={HERO_ROTATION} id="main-content" />

      {/* ── Convert your image ── */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold">Convert your image</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Drop any photo or logo. We add a gain map layer and return it to you instantly — same file format, no upload, no account, no registration. Completely private, runs in your browser.
          </p>
          <div className="mt-6 w-full">
            <HomeDropZone label="INSTANT IN BROWSER" />
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Make your logo or photos look spectacular on HDR displays. <span className="text-[var(--foreground)] font-medium">Be the hero at your company.</span>
          </p>
        </div>
      </section>

      <div>
        <div className="mx-auto max-w-7xl space-y-20 px-4 pb-24 pt-6 sm:px-6 lg:px-8">
          {/* ── Logo + Photo proof ── */}
          <ImageProofSection
            photoPeek={PHOTO_PEEK}
          />

          {/* ── HDR primer ── */}
          <section className="border-t border-[var(--border)] pt-12">
            <h2 className="font-display text-2xl font-bold">
              What is a gain map image?
            </h2>
            <div className="mt-6 grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
              <div className="grid gap-4 text-sm leading-7 text-[var(--muted)]">
                <p>
                  HDR is an expanded brightness range: image highlights can sit above the SDR ceiling. A gain map image encodes a normal SDR image plus a secondary brightness map. Unsupported apps render the SDR layer and ignore the rest.
                </p>
                <p>
                  EDR is Apple&apos;s term for <em>displaying</em> brightness above SDR reference white. HDR describes the image content. They are not the same word and are often misused interchangeably.
                </p>
                <p>
                  The cross-platform technical name is <strong className="text-[var(--foreground)]">HDR gain map image</strong>. Consumer brands include Adaptive HDR (Apple) and Ultra HDR (Android/Google). This site encodes those files locally in the browser. No upload, no server.
                </p>
                <p className="text-xs leading-6">
                  Blacks do not necessarily get blacker. EDR lifts highlights, not the shadow floor.
                </p>
                <p>
                  <a href="/docs" className="text-[var(--accent)] underline underline-offset-2 transition hover:opacity-75">
                    Learn more in /docs →
                  </a>
                </p>
              </div>

              <aside
                className="self-start rounded-[var(--radius)] border px-5 py-4 text-sm leading-6"
                style={{
                  borderColor: "color-mix(in srgb, var(--accent) 22%, var(--border))",
                  background: "color-mix(in srgb, var(--accent) 6%, var(--panel))",
                }}
              >
                <p className="font-semibold text-[var(--foreground)]">Monitor note</p>
                <p className="mt-2 text-[var(--muted)]">
                  Ultra paints past SDR reference white. On an HDR display (Apple XDR, Android Ultra HDR, or Windows Advanced Color), the effect is visible. On an SDR monitor it renders as ordinary white. That is expected, not a bug.
                </p>
              </aside>
            </div>
          </section>

          {/* ── Developers ── */}
          <section className="border-t border-[var(--border)] pt-12">
            <h2 className="font-display text-2xl font-bold">
              For developers
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Build gain map encoding into your pipeline or CI. MIT licensed, 100% test coverage, available via Docker, npm, Homebrew, and curl.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
              {["Docker", "npm", "Homebrew", "curl", "CLI", "MIT licensed", "100% test coverage"].map((kw) => (
                <span key={kw} className="rounded border border-[var(--border)] px-2 py-0.5">{kw}</span>
              ))}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold">From the terminal</h3>
                <a href="/developers#cli" className="text-sm text-[var(--accent)] hover:opacity-75 transition">Learn more →</a>
              </div>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Batch-encode gain map images without a browser.
              </p>
              <div className="mt-4">
                <InstallSwitcher />
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold">Add Ultra text to your project</h3>
                <a href="/developers#agent-skill" className="text-sm text-[var(--accent)] hover:opacity-75 transition">Learn more →</a>
              </div>
              <UltraSkillCard hideHeading />
            </div>
          </section>

          {/* ── Product Hunt ── */}
          <section className="border-t border-[var(--border)] pt-12">
            <div className="flex items-start gap-4">
              <UltraIcon size={28}>
                <ThumbUpIcon />
              </UltraIcon>
              <div className="grid gap-2">
                <p className="font-display text-base font-bold text-[var(--foreground)]">
                  Upvote on Product Hunt
                </p>
                <p className="text-sm text-[var(--muted)]">
                  Upvotes help designers and photographers find it.
                </p>
                <a
                  href={PRODUCT_HUNT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex w-fit items-center gap-2 rounded-[var(--radius)] border border-[#da552f]/60 bg-[color-mix(in_srgb,#da552f_14%,var(--panel))] px-4 py-2 text-sm font-semibold text-[#ff8a3d] transition hover:border-[#da552f] hover:bg-[color-mix(in_srgb,#da552f_20%,var(--panel))] hover:text-[#ff9f5a]"
                  aria-label="Upvote on Product Hunt"
                >
                  View on Product Hunt →
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

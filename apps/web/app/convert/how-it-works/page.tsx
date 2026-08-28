import type { Metadata } from "next";
import {
  ArrowForwardIcon as ArrowRightFilled,
  LockIcon as LockFilled,
  PhotoIcon as PicFilled,
  VerifiedUserIcon as ShieldFilled,
  LayersIcon as LayersFilled,
  SwapHorizIcon as TransferFilled,
} from "@/components/icons";
import { PageChrome } from "@/components/page-chrome";
import { UltraIcon } from "@/components/ultra-icon";
import { UltraWord } from "@/components/ultra-word";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";

export const metadata: Metadata = {
  title: "How it works · Gainmaps",
  description: "What changes in the image, the encoding pipeline, supported formats, privacy, and limits.",
  alternates: { canonical: "/convert/how-it-works" },
  openGraph: { type: "website", url: "/convert/how-it-works" },
};

const sections = [
  ["What changes", "#what-changes"],
  ["Pipeline", "#pipeline"],
  ["Formats", "#formats"],
  ["Privacy", "#privacy"],
  ["Limits", "#limits"],
];

const PIPELINE_STEPS = [
  "Files arrive via drag-and-drop or the file picker.",
  "The page sends each file to /hdr-service-worker.js over a MessageChannel.",
  "The worker detects format: PNG, JPEG, GIF, HEIC, WebP, AVIF, or any browser-decodable bitmap.",
  "Pixels are decoded to RGBA and converted to linear light.",
  "Linear values are scaled by gain intensity, creating synthetic HDR capacity.",
  "A gain map is computed against a Reinhard-tone-mapped SDR base image.",
  "The result is encoded as an Ultra HDR JPEG Blob and returned for download.",
];

const SECTION_ICON_CLS = "flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)-2px)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel))] text-[var(--accent)]";

export default function HowItWorksPage() {
  return (
    <main>
      <PageChrome />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:px-8">

        {/* Sidebar TOC */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav className="ultra-surface grid gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-2 text-sm">
            {sections.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="flex items-center justify-between rounded-[calc(var(--radius)-2px)] px-3 py-2 text-[var(--muted)] transition hover:bg-[var(--panel-strong)] hover:text-[var(--foreground)]"
              >
                {label}
                <ArrowRightFilled aria-hidden size={14} />
              </a>
            ))}
          </nav>

          <div className="mt-4 grid gap-1 text-sm">
            <a
              href="/convert"
              className="flex items-center justify-between rounded-[calc(var(--radius)-2px)] px-3 py-2 text-[var(--accent)] transition hover:bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]"
            >
              ← Back to convert
              <ArrowRightFilled aria-hidden size={14} />
            </a>
          </div>
        </aside>

        {/* Main article */}
        <article className="min-w-0">
          <header className="border-b border-[var(--border)] pb-10">
            <p className="mb-4 text-sm font-medium text-[var(--muted)]">Technical document</p>
            <h1 className="font-display max-w-4xl text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl">
              <UltraWord text="How it works" typeClassName="font-display max-w-4xl text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl" intensity={TEXT_ULTRA_INTENSITY} />
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-[var(--muted)]">
              A gain map image carries two things: a standard SDR baseline every app can open, and a
              secondary brightness layer (the gain map) that HDR displays use to expand highlights
              past SDR reference white. Gainmaps synthesizes that second layer locally, in your
              browser, from the pixels you give it.
            </p>
          </header>

          {/* ── What changes ── */}
          <section id="what-changes" className="scroll-mt-24 border-b border-[var(--border)] py-10">
            <div className="flex items-center gap-3">
              <span className={SECTION_ICON_CLS} aria-hidden>
                <UltraIcon size={16}><LayersFilled /></UltraIcon>
              </span>
              <h2 className="font-display text-2xl font-bold tracking-normal">What changes</h2>
            </div>
            <div className="mt-5 grid gap-4 text-sm leading-7 text-[var(--muted)]">
              <p>
                The worker rasterizes your photo, builds linear HDR capacity from the SDR pixels using
                the chosen gain intensity, tone-maps an SDR base, and writes a single gain map image.
                The output file is larger than the input: it carries both the SDR image and the gain
                map, but opens normally in any JPEG viewer.
              </p>
              <p>
                This is not camera-scene HDR reconstruction. Without original HDR capture data, the
                tool synthesizes headroom from the SDR image. Compatible viewers (Apple Preview,
                Photos, Android Ultra HDR clients) can then expand the gain map on capable displays.
              </p>
            </div>
          </section>

          {/* ── Pipeline ── */}
          <section id="pipeline" className="scroll-mt-24 border-b border-[var(--border)] py-10">
            <div className="flex items-center gap-3">
              <span className={SECTION_ICON_CLS} aria-hidden>
                <UltraIcon size={16}><TransferFilled /></UltraIcon>
              </span>
              <h2 className="font-display text-2xl font-bold tracking-normal">Pipeline</h2>
            </div>
            <ol className="mt-5 grid gap-2">
              {PIPELINE_STEPS.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel-strong)] text-[10px] font-bold tabular-nums text-[var(--muted)]">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-7 text-[var(--muted)]">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* ── Formats ── */}
          <section id="formats" className="scroll-mt-24 border-b border-[var(--border)] py-10">
            <div className="flex items-center gap-3">
              <span className={SECTION_ICON_CLS} aria-hidden>
                <UltraIcon size={16}><PicFilled /></UltraIcon>
              </span>
              <h2 className="font-display text-2xl font-bold tracking-normal">Formats</h2>
            </div>
            <div className="mt-5 grid gap-4 text-sm leading-7 text-[var(--muted)]">
              <p>
                <span className="font-medium text-[var(--foreground)]">Input:</span>{" "}
                PNG, JPEG, WebP, AVIF, GIF (first frame only), HEIC when the browser decoder can open
                it, and SVG including animated SMIL/CSS SVG. Animations are frozen to a keyframe,
                then encoded.
              </p>
              <p>
                <span className="font-medium text-[var(--foreground)]">Output:</span>{" "}
                a JPEG-container gain map — JPEG inputs keep their extension; other containers write as{" "}
                <code className="rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono text-[var(--foreground)]">*-gainmap.jpg</code>.
                The file contains both layers and can be opened by any standard JPEG viewer.
              </p>
            </div>
          </section>

          {/* ── Privacy ── */}
          <section id="privacy" className="scroll-mt-24 border-b border-[var(--border)] py-10">
            <div className="flex items-center gap-3">
              <span className={SECTION_ICON_CLS} aria-hidden>
                <UltraIcon size={16}><ShieldFilled /></UltraIcon>
              </span>
              <h2 className="font-display text-2xl font-bold tracking-normal">Privacy</h2>
            </div>
            <div className="mt-5 grid gap-4 text-sm leading-7 text-[var(--muted)]">
              <p>
                Files never leave the browser for processing. The service worker encodes locally and
                returns a downloadable blob. No bytes travel to any server. Closing the tab discards
                all in-memory results.
              </p>
              <div
                className="flex items-start gap-3 rounded-[var(--radius)] border px-4 py-3"
                style={{
                  borderColor: "color-mix(in srgb, var(--accent) 22%, var(--border))",
                  background: "color-mix(in srgb, var(--accent) 6%, var(--panel))",
                }}
              >
                <UltraIcon size={16} className="mt-0.5 shrink-0 text-[var(--accent)]">
                  <LockFilled />
                </UltraIcon>
                <p className="text-[var(--muted)]">
                  The converter works offline after the first load. There is no backend, no analytics
                  pipeline, no upload endpoint.
                </p>
              </div>
            </div>
          </section>

          {/* ── Limits ── */}
          <section id="limits" className="scroll-mt-24 py-10">
            <h2 className="font-display text-2xl font-bold tracking-normal">Limits</h2>
            <div className="mt-5 grid gap-4 text-sm leading-7 text-[var(--muted)]">
              <p>
                Very large images may be slow to encode in-browser; the worker is single-threaded per
                file. Animated GIF only encodes the first frame. HEIC decoding depends on platform
                support. Gain-map appearance varies by viewer software and display peak luminance:
                the same file looks different on an iPhone XDR versus an SDR monitor.
              </p>
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}

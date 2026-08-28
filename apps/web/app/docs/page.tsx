import type { Metadata } from "next";
import {
  ArrowForwardIcon as ArrowRightFilled,
  BookmarkIcon as BookmarkFilled,
  OpenInNewIcon as ExternalLinkFilled,
  BoltIcon as LightningFilled,
  AutoAwesomeIcon as SparklesFilled,
  LightModeIcon as SunFilled,
} from "@/components/icons";

import { PageChrome } from "@/components/page-chrome";
import { UltraIcon } from "@/components/ultra-icon";
import { UltraWord } from "@/components/ultra-word";
import { BRAND_NAMES } from "@/lib/brand-names";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Terminology, standards, and gain-map concepts: EDR vs HDR, ISO 21496-1, Android Ultra HDR, Apple Adaptive HDR, and CSS Color HDR.",
  alternates: { canonical: "/docs" },
  openGraph: { type: "website", url: "/docs" },
};

const sections = [
  ["Names", "#names"],
  ["Gain", "#gain"],
  ["Standards", "#standards"],
];

const resources = [
  ["Ultra HDR Image Format v1.1", "https://developer.android.com/media/platform/hdr-image-format", "Google's free gain-map JPEG spec (hdrgm XMP + MPF). The readable encoding reference."],
  ["Support Ultra HDR", "https://developer.android.com/media/grow/ultra-hdr", "Android app guide for displaying and editing Ultra HDR."],
  ["android.graphics.Gainmap", "https://developer.android.com/reference/android/graphics/Gainmap", "Platform API for gain-map metadata and rendering."],
  ["libultrahdr", "https://github.com/google/libultrahdr", "Google's reference Ultra HDR codec."],
  ["AVIF tone map (tmap)", "https://aomediacodec.github.io/av1-avif/latest-approved.html#tone-map-derived-image-item", "AOM AVIF spec: HEIF tmap derived item and altr fallback for gain maps."],
  ["Applying Apple HDR effect", "https://developer.apple.com/documentation/appkit/applying-apple-hdr-effect-to-your-photos", "Decode Apple HDR gain maps without Apple SDKs (MakerNote 33/48, Rec.709 map)."],
  ["Supporting HDR images in your app", "https://developer.apple.com/documentation/uikit/supporting-hdr-images-in-your-app", "Load, display, edit, and save HDR stills (SwiftUI / UIKit / Core Image)."],
  ["Enhancing HDR image rendering", "https://developer.apple.com/documentation/coregraphics/adopting-advancements-in-hdr-image-rendering", "Headroom, constrained vs full HDR, and CGContentToneMappingInfo."],
  ["WWDC24: Use HDR for dynamic image experiences", "https://developer.apple.com/videos/play/wwdc2024/10177/", "Adaptive HDR, expandToHDR, and ISO vs Apple gain maps."],
  ["WWDC23: Support HDR images in your app", "https://developer.apple.com/videos/play/wwdc2023/10181/", "Identify, load, display, and write ISO HDR and gain-map HDR."],
  ["CSS Color HDR Module Level 1", "https://www.w3.org/TR/css-color-hdr-1/", "W3C spec: dynamic-range-limit, color-hdr(), and HDR color spaces."],
  ["dynamic-range-limit", "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/dynamic-range-limit", "CSS property this site uses to clamp or unlock Ultra."],
  ["GPUCanvasContext.configure", "https://developer.mozilla.org/en-US/docs/Web/API/GPUCanvasContext/configure", "WebGPU canvas toneMapping: standard vs extended (rgba16float above 1.0)."],
  ["Chrome: WebGPU HDR canvas", "https://developer.chrome.com/blog/new-in-webgpu-129", "Chromium shipping notes for GPUCanvasToneMappingMode extended."],
  ["ITU-R BT.2408", "https://www.itu.int/rec/R-REC-BT.2408", "Free ITU recommendation: HDR production and 203 cd/m² reference white."],
  ["ISO 21496-1:2025", "https://www.iso.org/standard/86775.html", "Cross-vendor gain-map metadata standard. Catalog page only; full text is ISO-paywalled. Use Ultra HDR v1.1 above for the free spec."],
  ["MDN Service Worker API", "https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API", "Documents the browser worker model used for local processing."],
  ["MDN OffscreenCanvas", "https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas", "Documents off-main-thread canvas rendering used for browser-decodable formats."],
  ["MDN createImageBitmap", "https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/createImageBitmap", "Documents worker-side image decoding for Blob and bitmap sources."],
];

const SECTION_ICON_CLS = "flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)-2px)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel))] text-[var(--accent)]";

export default function Base() {
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

          {/* Try it links */}
          <div className="mt-4 grid gap-1 text-sm">
            <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--muted)]">
              Try it
            </p>
            {[
              ["/convert", "Convert a photo"],
              ["/photos", "Browse HDR photos"],
              ["/logos", "Browse logos"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="flex items-center justify-between rounded-[calc(var(--radius)-2px)] px-3 py-2 text-[var(--accent)] transition hover:bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]"
              >
                {label}
                <ArrowRightFilled aria-hidden size={14} />
              </a>
            ))}
          </div>
        </aside>

        {/* Main article */}
        <article className="min-w-0">
          <header className="border-b border-[var(--border)] pb-10">
            <p className="mb-4 text-sm font-medium text-[var(--muted)]">Technical document</p>
            <h1 className="font-display max-w-4xl text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl">
              <UltraWord text="Ultra HDR Reference" typeClassName="font-display max-w-4xl text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl" intensity={TEXT_ULTRA_INTENSITY} />
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-[var(--muted)]">
              Quick reference for the terminology, gain-map concepts, and standards behind Ultra HDR
              images — EDR vs HDR, Android Ultra HDR (free format spec), Apple Adaptive HDR, CSS Color HDR, and ISO 21496-1.
            </p>
          </header>

          {/* ── Names ── */}
          <section id="names" className="scroll-mt-24 border-b border-[var(--border)] py-10">
            <div className="flex items-center gap-3">
              <span className={SECTION_ICON_CLS} aria-hidden>
                <UltraIcon size={16}><BookmarkFilled /></UltraIcon>
              </span>
              <h2 className="font-display text-2xl font-bold tracking-normal">Names</h2>
            </div>
            <div className="mt-5 grid gap-4 text-sm leading-7 text-[var(--muted)]">
              <p>
                Vendors, platforms, and standards each coined their own name for the same idea:
                brightness above SDR reference white, encoded so every app can still open the file.
              </p>
              <p>
                On a Mac, when the display raises brightness to show an HDR image, that path is
                Extended Dynamic Range (EDR). EDR is Apple&apos;s way of <em>displaying</em> brightness
                above SDR reference white. HDR describes the image content. They are not the same
                word, and they are often used interchangeably by mistake.
              </p>
              <p>
                An EDR JPEG is possible: it is usually called an HDR JPEG with a gain map. The file
                holds a normal SDR JPEG plus extra brightness data. Unsupported apps show the SDR
                layer. Editing or reexporting the image may strip the map. Apple calls the still-image
                system Adaptive HDR; Android and Google call the JPEG format Ultra HDR, the closest
                Android equivalent to an EDR JPEG. The cross-platform technical name is HDR gain map
                image.
              </p>
              <p>
                EDR lifts highlights, not the shadow floor. Blacks do not necessarily get blacker.
              </p>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[540px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="pb-2 pr-4 font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Name</th>
                    <th className="pb-2 pr-4 font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Full form</th>
                    <th className="pb-2 pr-4 font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Platform</th>
                    <th className="pb-2 font-medium uppercase tracking-[0.08em] text-[var(--muted)]">What it means</th>
                  </tr>
                </thead>
                <tbody>
                  {BRAND_NAMES.map((row) => (
                    <tr key={row.name} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="py-2.5 pr-4 font-semibold text-[var(--foreground)]">{row.name}</td>
                      <td className="py-2.5 pr-4 text-[var(--muted)]">{row.fullName}</td>
                      <td className="py-2.5 pr-4 text-[var(--muted)]">{row.platform}</td>
                      <td className="py-2.5 text-[var(--muted)]">{row.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Gain ── */}
          <section id="gain" className="scroll-mt-24 border-b border-[var(--border)] py-10">
            <div className="flex items-center gap-3">
              <span className={SECTION_ICON_CLS} aria-hidden>
                <UltraIcon size={16}><SunFilled /></UltraIcon>
              </span>
              <h2 className="font-display text-2xl font-bold tracking-normal">Gain</h2>
            </div>
            <div className="mt-5 grid gap-4 text-sm leading-7 text-[var(--muted)]">
              <p>
                Gain is the maximum HDR/SDR brightness ratio encoded into the photo. The default mid
                setting targets roughly 3.34×, similar to many iPhone HDR stills. Lower values are
                subtler; higher values push brighter highlights on HDR displays.
              </p>
              <p>
                The nav{" "}
                <span className="inline-flex items-center gap-1 font-medium text-[var(--foreground)]">
                  <UltraIcon size={13}><SparklesFilled /></UltraIcon>
                  Ultra
                </span>{" "}
                switch controls CSS{" "}
                <code className="rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono text-[var(--foreground)]">dynamic-range-limit</code>{" "}
                for the whole page: Off clamps to SDR reference white; On unlocks Ultra photos and{" "}
                <code className="rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono text-[var(--foreground)]">color-hdr()</code>{" "}
                accents on capable displays. See how it looks on{" "}
                <a href="/text" className="text-[var(--accent)] underline underline-offset-2 transition hover:opacity-75">
                  the Ultra text demo →
                </a>
              </p>
            </div>
          </section>

          {/* ── Standards ── */}
          <section id="standards" className="scroll-mt-24 py-10">
            <div className="flex items-center gap-3">
              <span className={SECTION_ICON_CLS} aria-hidden>
                <UltraIcon size={16}><LightningFilled /></UltraIcon>
              </span>
              <h2 className="font-display text-2xl font-bold tracking-normal">Standards</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {resources.map(([label, href, detail]) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="ultra-surface grid gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 transition hover:border-[var(--accent)]"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                    {label}
                    <ExternalLinkFilled aria-hidden size={14} />
                  </span>
                  <span className="text-sm leading-6 text-[var(--muted)]">{detail}</span>
                </a>
              ))}
            </div>
          </section>

        </article>
      </div>
    </main>
  );
}

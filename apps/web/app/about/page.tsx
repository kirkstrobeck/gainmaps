import type { Metadata } from "next";
import { PageChrome } from "@/components/page-chrome";
import { UltraWord } from "@/components/ultra-word";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";

export const metadata: Metadata = {
  title: "About · Gainmaps",
  description: "Gainmaps converts photos to HDR gain map images locally in the browser — no upload, no server. Learn about the project, the CLI, and how gain map images work.",
  alternates: { canonical: "/about" },
  openGraph: { type: "website", url: "/about" },
};

export default function AboutPage() {
  return (
    <main>
      <PageChrome />
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold tracking-normal">
          <UltraWord text="About" typeClassName="font-display text-4xl font-bold tracking-normal" intensity={TEXT_ULTRA_INTENSITY} />
        </h1>
        <div className="mt-8 grid gap-6 text-base leading-7 text-[var(--muted)]">
          <p>
            A gain map image encodes an SDR photo alongside a secondary brightness map. On HDR displays
            — Apple XDR, Android Ultra HDR, Windows Advanced Color — highlights render above SDR reference
            white. On SDR displays the image renders normally; the format is fully backward compatible.
          </p>
          <p>
            Gainmaps.com demonstrates browser-based conversion. Drop any JPEG, PNG, HEIC, WebP, or
            AVIF into the{" "}
            <a href="/convert" className="text-[var(--accent)] underline underline-offset-2">converter</a>.
            Processing runs locally in a service worker — no file leaves your device, no upload, no server.
          </p>
          <p>
            The{" "}
            <code className="rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono text-[var(--foreground)]">gainmap</code>{" "}
            CLI batch-encodes images from your terminal. It targets ISO 21496-1 (Ultra HDR JPEG). Install via
            npm, Homebrew, or curl — see{" "}
            <a href="/developers" className="text-[var(--accent)] underline underline-offset-2">Developer docs</a>.
          </p>
          <p>
            The project is open source.{" "}
            <a
              href="https://github.com/kirkstrobeck/gainmaps.com"
              className="text-[var(--accent)] underline underline-offset-2"
              rel="noopener noreferrer"
              target="_blank"
            >
              github.com/kirkstrobeck/gainmaps.com →
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

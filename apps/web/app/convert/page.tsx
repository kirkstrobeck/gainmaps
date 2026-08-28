import type { Metadata } from "next";
import { preload } from "react-dom";
import { HdrProcessor } from "@/components/hdr-processor";
import { SiteNav } from "@/components/site-nav";
import { UltraWord } from "@/components/ultra-word";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";

export const metadata: Metadata = {
  title: "Convert · Gainmaps",
  description: "Drop photos to encode gain map images. Processed 100% in your browser via a service worker. Nothing uploaded, nothing sent to a server.",
  alternates: { canonical: "/convert" },
  openGraph: { type: "website", url: "/convert" },
};

export default function Base() {
  preload("/hdr-service-worker.js", { as: "script" });
  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden">
      <SiteNav />
      <header className="mx-auto w-full max-w-7xl px-4 pb-4 pt-6 sm:px-6 lg:px-8">
        <h1 className="font-display text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl">
          <UltraWord text="Convert" typeClassName="font-display text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl" intensity={TEXT_ULTRA_INTENSITY} />
        </h1>
        <a href="/convert/how-it-works" className="text-sm text-[var(--accent)] underline underline-offset-2 transition hover:opacity-75">
          How it works →
        </a>
      </header>
      <HdrProcessor />
    </main>
  );
}

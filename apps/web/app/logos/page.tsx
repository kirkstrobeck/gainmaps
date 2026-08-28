import type { Metadata } from "next";

import { LogosGrid } from "@/components/logos-grid";
import { UltraWord } from "@/components/ultra-word";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";
import { PageChrome } from "@/components/page-chrome";
import { COMPANIES } from "@/lib/logos/companies";

export const metadata: Metadata = {
  title: "Logos · Gainmaps",
  description:
    "Brand logos side by side: the standard SVG next to the same mark encoded as a gain map.",
  alternates: { canonical: "/logos" },
  openGraph: { type: "website", url: "/logos" },
};

export default function Base() {
  return (
    <main>
      <PageChrome />
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <header className="border-b border-[var(--border)] pb-10">
          <h1 className="font-display text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl">
            <UltraWord text="Logos" typeClassName="font-display text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl" intensity={TEXT_ULTRA_INTENSITY} />
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            {COMPANIES.length} brand logos. Standard SVG beside the same mark encoded as an{" "}
            <strong className="font-medium text-[var(--foreground)]">Ultra</strong> HDR gain map.
            Brand colors reach past SDR white on HDR displays.
          </p>
        </header>

        <LogosGrid companies={COMPANIES} />
      </div>
    </main>
  );
}

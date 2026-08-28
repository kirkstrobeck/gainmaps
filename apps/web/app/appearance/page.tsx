import type { Metadata } from "next";
import { cookies } from "next/headers";

import {
  AppearanceControls,
  type AppearanceMode,
  type AppearanceState,
} from "@/components/appearance-controls";
import { AppearanceHello } from "@/components/appearance-hello";
import { SiteNav } from "@/components/site-nav";
import { UltraWord } from "@/components/ultra-word";
import { parseSiteMode, parseSiteUltra } from "@/lib/site-appearance";
import { TEXT_ULTRA_INTENSITY, TEXT_ULTRA_SLIDER_DEFAULT } from "@/lib/text-ultra";

export const metadata: Metadata = {
  title: "Appearance · Gainmaps",
  description: "Adjust light/dark and Ultra intensity to see how gain maps look on your display.",
  alternates: { canonical: "/appearance" },
  openGraph: { type: "website", url: "/appearance" },
};

const DEFAULT_INTENSITY = TEXT_ULTRA_SLIDER_DEFAULT;
const H1_CLS = "font-display text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl";

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseMode(value: string | undefined): AppearanceMode {
  return parseSiteMode(value);
}

function parseIntensity(value: string | undefined): number {
  if (value == null || value === "") return DEFAULT_INTENSITY;
  const next = Number(value);
  if (!Number.isFinite(next)) return DEFAULT_INTENSITY;
  return Math.min(100, Math.max(0, Math.round(next)));
}

function stateFromRequest(
  params: Record<string, string | string[] | undefined>,
  cookieMode: string | undefined,
  cookieUltra: string | undefined,
  cookieIntensity: string | undefined,
): AppearanceState {
  const modeFromUrl = first(params.mode);
  const ultraFromUrl = first(params.ultra);
  return {
    mode: parseMode(modeFromUrl ?? cookieMode),
    system: first(params.system) !== "off",
    ultra: parseSiteUltra(ultraFromUrl ?? cookieUltra) === "on",
    intensity: parseIntensity(first(params.intensity) ?? cookieIntensity),
  };
}

export default async function Base({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const jar = await cookies();
  const initial = stateFromRequest(
    await searchParams,
    jar.get("site-mode")?.value,
    jar.get("site-ultra")?.value,
    jar.get("site-intensity")?.value,
  );

  return (
    <div
      className="appearance-lab min-h-dvh"
      data-mode={initial.mode}
      data-system={initial.system ? "on" : "off"}
      data-resolved={initial.mode}
      data-ultra={/* v8 ignore next */ initial.ultra ? "on" : "off"}
      suppressHydrationWarning
    >
      <div className="relative z-10">
        <SiteNav />
      </div>
      <AppearanceHello />

      <div className="appearance-bar-slot">
        <header className="appearance-bar">
          <AppearanceControls initial={initial} />
        </header>
      </div>

      <main className="appearance-main flex flex-col items-center justify-end pb-10">
        <h1 className={`${H1_CLS} text-center text-[var(--foreground)]`}>
          <UltraWord text="Appearance" typeClassName={H1_CLS} intensity={TEXT_ULTRA_INTENSITY} />
        </h1>
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--muted)] opacity-50">
          Ultra lifts highlights past SDR reference white
        </p>
      </main>
    </div>
  );
}

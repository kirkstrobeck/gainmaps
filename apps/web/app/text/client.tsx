"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

import { ArrowForwardIcon, AutoAwesomeIcon, TerminalIcon, TextFieldsIcon } from "@/components/icons";
import { SiteNav } from "@/components/site-nav";
import { UltraSkillCard } from "@/components/ultra-skill-card";
import { UltraWord } from "@/components/ultra-word";
import {
  sliderToHeadroom,
  TEXT_ULTRA_SLIDER_DEFAULT,
} from "@/lib/text-ultra";

function sliderFromSearch(raw: string | null): number {
  const v = Number(raw ?? String(TEXT_ULTRA_SLIDER_DEFAULT));
  if (!Number.isFinite(v)) return TEXT_ULTRA_SLIDER_DEFAULT;
  return Math.min(100, Math.max(0, Math.round(v)));
}

export function TextPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [slider, setSlider] = useState(() => sliderFromSearch(searchParams?.get("intensity") ?? null));
  const headroom = sliderToHeadroom(slider);

  function handleIntensity(next: number) {
    const clamped = sliderFromSearch(String(next));
    setSlider(clamped);
    const params = new URLSearchParams(window.location.search);
    params.set("intensity", String(clamped));
    router.replace(`?${params.toString()}`);
  }

  return (
    <main>
      <SiteNav />
      <section className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
        <header>
          <h1 className="font-display text-4xl font-bold leading-[1.03] tracking-normal sm:text-5xl">
            <UltraWord text="Ultra text demo" typeClassName="font-display text-4xl font-bold leading-[1.03] tracking-normal sm:text-5xl" intensity={headroom} />
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Drag the slider to preview the same mask-and-canvas Ultra text implementation documented for product teams and coding agents.
          </p>
        </header>

        <div className="ultra-surface overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)]">
          {/* UltraWord stage */}
          <div
            className="flex min-h-[18rem] flex-col justify-center gap-5 px-8 py-10"
            style={{
              background: "color-mix(in srgb, var(--accent) 5%, var(--panel))",
            }}
          >
            <UltraWord
              text="Gainmaps"
              typeClassName="font-display text-6xl font-bold sm:text-7xl lg:text-8xl"
              intensity={headroom}
            />
            <UltraWord
              text="Ultra"
              typeClassName="font-display text-3xl font-bold sm:text-4xl"
              intensity={headroom}
            />
            <UltraWord
              text="HDR"
              typeClassName="font-display text-xl font-bold sm:text-2xl"
              intensity={headroom}
            />
          </div>

          {/* Instrument slider bar */}
          <div className="flex items-center gap-4 border-t border-[var(--border)] px-6 py-4">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={slider}
              onChange={(event) => handleIntensity(Number(event.target.value))}
              className="flex-1 accent-[var(--accent)]"
              aria-label="Intensity"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={slider}
            />
            <span className="w-14 text-right font-mono text-sm tabular-nums text-[var(--muted)]">
              {headroom.toFixed(2)}×
            </span>
          </div>
        </div>

        <section aria-labelledby="text-implementation" className="grid min-w-0 gap-4 border-t border-[var(--border)] pt-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-[calc(var(--radius)-2px)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel))] text-[var(--accent)]" aria-hidden>
                <TextFieldsIcon size={16} />
              </span>
              <h2 id="text-implementation" className="font-display text-2xl font-bold tracking-normal">
                Build this into your interface
              </h2>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Ultra text keeps real selectable text in the document, uses SVG masks for the letterforms, and paints HDR headroom with layered canvases. The developer guide covers the anti-crispy edge treatment, install path, and copy-ready prompt.
            </p>
          </div>

          <nav aria-label="Ultra text implementation links" className="grid min-w-0 gap-2 sm:grid-cols-3 lg:min-w-[34rem]">
            {[
              { href: "/developers#agent-skill", label: "Implementation", Icon: AutoAwesomeIcon },
              { href: "/developers#cli", label: "Developer docs", Icon: TerminalIcon },
              { href: "/docs#gain", label: "How gain maps work", Icon: TextFieldsIcon },
            ].map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                className="flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm font-medium text-[var(--foreground)] transition hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] hover:bg-[var(--panel-strong)]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon size={16} aria-hidden />
                  {label}
                </span>
                <ArrowForwardIcon size={14} aria-hidden />
              </a>
            ))}
          </nav>

          <div className="min-w-0 lg:col-span-2">
            <UltraSkillCard />
          </div>
        </section>
      </section>
    </main>
  );
}

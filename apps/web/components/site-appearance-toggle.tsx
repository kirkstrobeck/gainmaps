"use client";

import { DarkModeIcon as MoonFilled, LightModeIcon as SunFilled } from "@/components/icons";
import { useSyncExternalStore, type ReactNode } from "react";

import { UltraIcon } from "@/components/ultra-icon";
import {
  readSiteIntensity,
  readSiteMode,
  readSiteUltra,
  subscribeSiteAppearance,
  writeSiteAppearance,
  type SiteMode,
  type SiteUltra,
} from "@/lib/site-appearance";
import { cn } from "@/lib/utils";

function useSiteMode(): SiteMode {
  /* v8 ignore next */
  return useSyncExternalStore(subscribeSiteAppearance, readSiteMode, () => "dark");
}

function useSiteUltra(): SiteUltra {
  /* v8 ignore next */
  return useSyncExternalStore(subscribeSiteAppearance, readSiteUltra, () => "on");
}

export function SiteAppearanceToggle() {
  const mode  = useSiteMode();
  const ultra = useSiteUltra();

  function commit(next: { mode?: SiteMode; ultra?: SiteUltra }) {
    writeSiteAppearance({
      mode:      next.mode  ?? mode,
      ultra:     next.ultra ?? ultra,
      intensity: readSiteIntensity(),
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      {/* Light / Dark */}
      <div
        className="inline-flex items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-0.5 ultra-surface"
        role="group"
        aria-label="Color mode"
      >
        <ToggleOption
          active={mode === "light"}
          label="Light"
          title="Light appearance"
          onSelect={() => commit({ mode: "light" })}
        >
          <UltraIcon size={14}>
            <SunFilled />
          </UltraIcon>
        </ToggleOption>
        <ToggleOption
          active={mode === "dark"}
          label="Dark"
          title="Dark appearance"
          onSelect={() => commit({ mode: "dark" })}
        >
          <UltraIcon size={14}>
            <MoonFilled />
          </UltraIcon>
        </ToggleOption>
      </div>

      {/* Ultra Off / On */}
      <div
        className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-0.5 text-xs ultra-surface"
        role="group"
        aria-label="Ultra display"
      >
        <span className="hidden pl-2 font-medium text-[var(--muted)] sm:inline">Ultra</span>
        <ToggleOption
          active={ultra === "off"}
          label="Off"
          title="Clamp photos and previews to SDR reference white"
          onSelect={() => commit({ ultra: "off" })}
        />
        {/* "On" uses copper to signal elevation — not just a binary toggle */}
        <ToggleOption
          active={ultra === "on"}
          accentActive
          label="On"
          title="Unlock Ultra intensity in photos and previews"
          onSelect={() => commit({ ultra: "on" })}
        />
      </div>
    </div>
  );
}

function ToggleOption({
  active,
  label,
  title,
  onSelect,
  children,
  accentActive = false,
}: {
  active: boolean;
  label: string;
  title: string;
  onSelect: () => void;
  children?: ReactNode;
  accentActive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={title}
      onClick={onSelect}
      className={cn(
        "inline-flex min-w-8 items-center justify-center gap-1 rounded-[calc(var(--radius)-2px)] px-2 py-1.5 font-medium",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]",
        !active && "text-[var(--muted)] hover:text-[var(--foreground)]",
        active && !accentActive && "bg-[var(--foreground)] text-[var(--background)]",
        active && accentActive  && "bg-[var(--accent)] text-[var(--accent-foreground)]",
      )}
    >
      {children}
      {children ? <span className="sr-only">{label}</span> : label}
    </button>
  );
}

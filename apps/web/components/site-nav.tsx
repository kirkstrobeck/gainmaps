"use client";

import {
  GitHubIcon,
  SwapHorizIcon as ConvertIcon,
  PhotoIcon as GalleryIcon,
  DescriptionIcon as DocsIcon,
  TerminalIcon as DevIcon,
  ForumIcon as CommunityIcon,
  ContentCopyIcon as CopyFilled,
  CheckIcon as CheckFilled,
  OpenInNewIcon as Share2Filled,
  ProductHuntIcon,
  ArrowUpwardIcon,
} from "@/components/icons";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, useState, useCallback, useEffect } from "react";

import { NavPill } from "@/components/nav-pill";
import { UltraIcon } from "@/components/ultra-icon";
import { UltraWord } from "@/components/ultra-word";
import { PRODUCT_HUNT_URL } from "@/lib/product-hunt";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";
import { cn } from "@/lib/utils";
import { openDisplayCheck } from "@/lib/display-check-store";
import { SHOW_APPEARANCE_CONTROLS } from "@/lib/site-appearance-controls";
import {
  readSiteMode,
  readSiteUltra,
  readSiteIntensity,
  subscribeSiteAppearance,
  writeSiteAppearance,
  type SiteMode,
  type SiteUltra,
} from "@/lib/site-appearance";

const LINKS = [
  { href: "/convert",    label: "Convert",    Icon: ConvertIcon    },
  { href: "/photos",     label: "Gallery",    Icon: GalleryIcon    },
  { href: "/docs",       label: "Docs",       Icon: DocsIcon       },
  { href: "/developers", label: "Developers", Icon: DevIcon        },
  { href: "/community",  label: "Community",  Icon: CommunityIcon  },
] as const;

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const NAV_ACTION_TEXT = "nav-action-control";

const navActionBase =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[calc(var(--radius)-3px)] border transition-colors duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const shareButtonClass = cn(
  navActionBase,
  NAV_ACTION_TEXT,
  "h-8 w-[7rem] gap-1.5 border-[color-mix(in_srgb,var(--border)_82%,var(--foreground)_18%)] bg-[color-mix(in_srgb,var(--panel)_90%,var(--foreground)_10%)] px-2.5 text-[color:var(--foreground)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_10%,transparent)] hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] hover:bg-[color-mix(in_srgb,var(--panel)_82%,var(--accent)_18%)]",
);

const productHuntButtonClass = cn(
  shareButtonClass,
  "border-[#da552f]/60 bg-[color-mix(in_srgb,#da552f_14%,var(--panel))] text-[#ff8a3d] hover:border-[#da552f] hover:bg-[color-mix(in_srgb,#da552f_20%,var(--panel))] hover:text-[#ff9f5a]",
);

const menuShareButtonClass = cn(
  navActionBase,
  NAV_ACTION_TEXT,
  "h-9 min-w-0 gap-1.5 border-[color-mix(in_srgb,var(--border)_82%,var(--foreground)_18%)] bg-[color-mix(in_srgb,var(--panel)_90%,var(--foreground)_10%)] px-2.5 text-[color:var(--foreground)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_10%,transparent)] hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] hover:bg-[color-mix(in_srgb,var(--panel)_82%,var(--accent)_18%)]",
);

const menuProductHuntButtonClass = cn(
  menuShareButtonClass,
  "border-[#da552f]/60 bg-[color-mix(in_srgb,#da552f_14%,var(--panel))] text-[#ff8a3d] hover:border-[#da552f] hover:bg-[color-mix(in_srgb,#da552f_20%,var(--panel))] hover:text-[#ff9f5a]",
);

type ShareClusterProps = {
  menu?: boolean;
};

function ShareCluster({ menu = false }: ShareClusterProps = {}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await navigator.share({ title: document.title, url: window.location.href });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
    }
  }, []);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const actionClass = menu ? menuShareButtonClass : shareButtonClass;
  const productHuntClass = menu ? menuProductHuntButtonClass : productHuntButtonClass;

  return (
    <div className={menu ? "grid min-w-0 grid-cols-3 gap-2" : "flex items-center gap-1.5"}>
      {canShare ? (
        <button type="button" className={actionClass} aria-label="Share" onClick={handleShare}>
          <UltraIcon size={15}><Share2Filled /></UltraIcon>
          Share
        </button>
      ) : null}
      <button
        type="button"
        className={copied ? cn(actionClass, "border-[color-mix(in_srgb,var(--success,var(--accent))_40%,var(--border))] text-[color:var(--success,var(--accent))]") : actionClass}
        aria-label="Copy link"
        onClick={handleCopy}
      >
        <UltraIcon size={15}>{copied ? <CheckFilled /> : <CopyFilled />}</UltraIcon>
        {copied ? "Copied" : "Copy link"}
      </button>
      <a
        href={PRODUCT_HUNT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={productHuntClass}
        aria-label="Upvote on Product Hunt"
        title="Upvote on Product Hunt"
      >
        <ProductHuntIcon size={15} aria-hidden />
        <span>Upvote</span>
        <ArrowUpwardIcon size={13} aria-hidden />
      </a>
    </div>
  );
}

function useSiteMode(): SiteMode {
  return useSyncExternalStore(subscribeSiteAppearance, readSiteMode,
    /* v8 ignore next */
    () => "dark");
}
function useSiteUltra(): SiteUltra {
  return useSyncExternalStore(subscribeSiteAppearance, readSiteUltra,
    /* v8 ignore next */
    () => "on");
}

export function SiteNav() {
  const pathname = usePathname();
  const mode = useSiteMode();
  const ultra = useSiteUltra();
  const [menuOpen, setMenuOpen] = useState(false);

  function commit(next: { mode?: SiteMode; ultra?: SiteUltra }) {
    writeSiteAppearance({
      mode:      next.mode  ?? mode,
      ultra:     next.ultra ?? ultra,
      intensity: readSiteIntensity(),
    });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur-md">
      <nav className="mx-auto flex min-h-[52px] max-w-none items-center justify-between gap-3 px-4 sm:px-6 min-[1000px]:min-h-[58px] min-[1000px]:px-8 2xl:px-12">

        {/* Wordmark */}
        <a
          href="/"
          className={cn("shrink-0 font-display text-[17px] font-[600] [font-variation-settings:'wdth'_100] tracking-[-0.01em] text-[color:var(--foreground)] transition hover:opacity-80", FOCUS)}
        >
          <UltraWord text="Gainmaps" typeClassName="font-display text-[17px] font-[600] [font-variation-settings:'wdth'_100] tracking-[-0.01em]" intensity={TEXT_ULTRA_INTENSITY} />
        </a>

        {/* Desktop links + controls */}
        <div className="hidden min-w-0 items-center gap-4 min-[1000px]:flex">
          {LINKS.map(({ href, label }) => {
            const active = pathname != null && (pathname === href || pathname.startsWith(`${href}/`));
            return (
              <a
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap text-sm font-medium transition",
                  FOCUS,
                  active ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[color:var(--foreground)]",
                )}
              >
                {label}
              </a>
            );
          })}

          <div className="h-4 w-px shrink-0 bg-[var(--border)]" aria-hidden />

          {SHOW_APPEARANCE_CONTROLS && (
            <>
              <NavPill
                label="Color mode"
                leftLabel="DARK" rightLabel="LIGHT"
                leftActive={mode === "dark"}
                onToggle={() => commit({ mode: mode === "dark" ? "light" : "dark" })}
              />
              <NavPill
                label="Ultra display"
                leftLabel="SDR" rightLabel="ULTRA"
                leftActive={ultra === "off"}
                onToggle={() => commit({ ultra: ultra === "off" ? "on" : "off" })}
              />
            </>
          )}

          <ShareCluster />

          <button
            type="button"
            onClick={openDisplayCheck}
            className={cn("inline-flex h-8 shrink-0 items-center whitespace-nowrap text-xs font-medium text-[var(--muted)] transition hover:text-[color:var(--foreground)]", FOCUS)}
          >
            Display check
          </button>

          <a
            href="https://github.com/kirkstrobeck/gainmaps.com"
            aria-label="GitHub"
            target="_blank"
            rel="noopener noreferrer"
            className={cn("flex items-center text-[var(--muted)] transition hover:text-[color:var(--foreground)]", FOCUS)}
          >
            <UltraIcon size={18}><GitHubIcon /></UltraIcon>
          </a>
        </div>

        {/* Mobile: menu button only (no NavPill when appearance controls hidden) */}
        <div className="flex items-center gap-3 min-[1000px]:hidden">
          {SHOW_APPEARANCE_CONTROLS && (
            <NavPill
              label="Ultra display"
              leftLabel="SDR" rightLabel="ULTRA"
              leftActive={ultra === "off"}
              onToggle={() => commit({ ultra: ultra === "off" ? "on" : "off" })}
            />
          )}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn("inline-flex size-9 items-center justify-center rounded-[calc(var(--radius)-2px)] text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[color:var(--foreground)]", FOCUS)}
          >
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden>
              <line x1="0" y1="2" x2="20" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="0" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--panel)] px-4 py-3 min-[1000px]:hidden">
          {LINKS.map(({ href, label, Icon }) => (
            <a
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] hover:text-[var(--accent)]",
                pathname != null && pathname === href ? "text-[var(--accent)]" : "text-[var(--muted)]",
              )}
            >
              <UltraIcon size={16}><Icon /></UltraIcon>
              {label}
            </a>
          ))}
          <div className="mt-3 grid min-w-0 gap-2 border-t border-[var(--border)] pt-3">
            {SHOW_APPEARANCE_CONTROLS && (
              <NavPill
                label="Color mode"
                leftLabel="DARK" rightLabel="LIGHT"
                leftActive={mode === "dark"}
                onToggle={() => commit({ mode: mode === "dark" ? "light" : "dark" })}
              />
            )}
            <ShareCluster menu />
            <button
              type="button"
              onClick={() => { openDisplayCheck(); setMenuOpen(false); }}
              className={cn("inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded-[calc(var(--radius)-3px)] border border-[color-mix(in_srgb,var(--border)_82%,var(--foreground)_18%)] bg-[color-mix(in_srgb,var(--panel)_90%,var(--foreground)_10%)] px-3 nav-action-control text-[color:var(--foreground)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-colors duration-150 hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] hover:bg-[color-mix(in_srgb,var(--panel)_82%,var(--accent)_18%)] active:translate-y-px", FOCUS)}
            >
              Display check
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

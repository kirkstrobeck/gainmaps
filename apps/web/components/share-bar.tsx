"use client";

import { CheckIcon as CheckFilled, ContentCopyIcon as CopyFilled, OpenInNewIcon as Share2Filled } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";

import { UltraIcon } from "@/components/ultra-icon";

const buttonClass =
  "inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] hover:bg-[color-mix(in_srgb,var(--accent)_6%,var(--panel))] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const copiedClass =
  "inline-flex min-w-[6rem] items-center gap-1.5 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--success)_40%,var(--border))] bg-[color-mix(in_srgb,var(--success)_6%,var(--panel))] px-2.5 py-1 text-xs font-medium text-[var(--success)] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export function ShareBar() {
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

  return (
    <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 px-4 pb-3 pt-2 sm:px-6 lg:px-8">
      {canShare ? (
        <button type="button" className={buttonClass} aria-label="Share" onClick={handleShare}>
          <UltraIcon size={14}>
            <Share2Filled />
          </UltraIcon>
          Share
        </button>
      ) : null}
      <button type="button" className={copied ? copiedClass : `${buttonClass} min-w-[6rem]`} aria-label="Copy link" onClick={handleCopy}>
        {copied ? (
          <UltraIcon size={14}>
            <CheckFilled />
          </UltraIcon>
        ) : (
          <UltraIcon size={14}>
            <CopyFilled />
          </UltraIcon>
        )}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

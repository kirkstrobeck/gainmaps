/* Ultra mode by Kirk Strobeck */
"use client";

import { CheckIcon as CheckFilled, CloseIcon as CloseFilled, ContentCopyIcon as CopyFilled } from "@/components/icons";
import { useCallback, useState } from "react";

import { UltraIcon } from "@/components/ultra-icon";
import { cn } from "@/lib/utils";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

type Props = {
  text: string;
  label?: string;
  className?: string;
};

function stateLabel(copied: boolean, failed: boolean, defaultLabel?: string): string {
  if (copied) return "Copied";
  if (failed) return "Failed";
  return defaultLabel ?? "Copy";
}

function stateColor(copied: boolean, failed: boolean): string {
  if (copied) return "text-[var(--success)]";
  if (failed) return "text-[var(--danger)]";
  return "text-[var(--muted)] hover:text-[var(--accent)]";
}

export function CopyButton({ text, label, className }: Props) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 2000);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition",
        FOCUS,
        stateColor(copied, failed),
        className,
      )}
      aria-label={label ?? "Copy"}
    >
      <UltraIcon size={14}>
        {copied ? <CheckFilled /> : failed ? <CloseFilled /> : <CopyFilled />}
      </UltraIcon>
      {stateLabel(copied, failed, label)}
    </button>
  );
}

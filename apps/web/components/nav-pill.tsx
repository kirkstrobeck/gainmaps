"use client";

import { cn } from "@/lib/utils";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export function NavPill({
  leftLabel, rightLabel, leftActive, onToggle, label,
}: {
  leftLabel: string; rightLabel: string; leftActive: boolean;
  onToggle: () => void; label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!leftActive}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "inline-flex h-7 cursor-pointer items-center rounded-[999px] border border-[var(--border)] bg-[var(--panel)] p-0.5",
        FOCUS,
      )}
    >
      <span
        className={cn(
          "inline-flex h-full items-center rounded-[999px] px-2.5 font-mono text-[12px] font-medium",
          leftActive
            ? "bg-[var(--foreground)] text-[var(--background)]"
            : "text-[var(--muted)]",
        )}
      >
        {leftLabel}
      </span>
      <span
        className={cn(
          "inline-flex h-full items-center rounded-[999px] px-2.5 font-mono text-[12px] font-medium",
          !leftActive
            ? "bg-[var(--foreground)] text-[var(--background)]"
            : "text-[var(--muted)]",
        )}
      >
        {rightLabel}
      </span>
    </button>
  );
}

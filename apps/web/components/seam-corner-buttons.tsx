"use client";

import { cn } from "@/lib/utils";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

type SeamCornerButtonsProps = {
  seamSide: "sdr" | "ultra" | null;
  snapTo: (pct: number) => void;
};

export function SeamCornerButtons({ seamSide, snapTo }: SeamCornerButtonsProps) {
  return (
    <>
      <div
        className="inst-corner inst-corner-sdr"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={cn("inst-switch-btn", FOCUS)}
          aria-pressed={seamSide === "sdr"}
          aria-label="Show Standard"
          onClick={() => snapTo(100)}
        >
          SDR
        </button>
      </div>
      <div
        className="inst-corner inst-corner-ultra"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={cn("inst-switch-btn", FOCUS)}
          aria-pressed={seamSide === "ultra"}
          aria-label="Show Ultra"
          onClick={() => snapTo(0)}
        >
          <span className="inst-dot" aria-hidden />
          Ultra
        </button>
      </div>
    </>
  );
}

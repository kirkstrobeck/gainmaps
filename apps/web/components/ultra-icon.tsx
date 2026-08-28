"use client";

import { cloneElement, isValidElement, useId, type ReactElement } from "react";

import { UltraFillCanvas } from "@/components/ultra-fill-canvas";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";
import { ultraOverlayGeometry } from "@/lib/ultra-overlay";
import { cn } from "@/lib/utils";

type IconProps = {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
  "aria-hidden"?: boolean;
};

type Props = {
  children: ReactElement<IconProps>;
  size?: number;
  intensity?: number;
  className?: string;
};

/*
  Ultra fill masked to a Mingcute glyph. Bleed is 0 — icons sit in a tight box,
  unlike UltraWord which grows 50% for accents. The canvas is decoration; the
  parent control keeps the accessible name.
*/
export function UltraIcon({
  children,
  size = 17,
  intensity = TEXT_ULTRA_INTENSITY,
  className,
}: Props) {
  const maskId = `ultra-icon-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const mask = `url(#${maskId})`;
  const overlay = ultraOverlayGeometry(0);

  if (!isValidElement(children)) return null;

  const glyph = cloneElement(children, {
    width: "100%",
    height: "100%",
    color: "#ffffff",
    "aria-hidden": true,
    className: "h-full w-full",
  });

  return (
    <span
      aria-hidden
      className={cn("ultra-icon relative inline-block", className)}
      style={{ width: size, height: size }}
    >
      <svg aria-hidden className="pointer-events-none select-none" style={overlay}>
        <defs>
          <mask id={maskId}>{glyph}</mask>
        </defs>
      </svg>
      <span
        aria-hidden
        className="ultra-backdrop"
        style={{ ...overlay, mask, WebkitMask: mask }}
      />
      <UltraFillCanvas
        intensity={intensity}
        className="pointer-events-none"
        style={{ ...overlay, mask, WebkitMask: mask }}
      />
    </span>
  );
}

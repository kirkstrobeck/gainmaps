// Ultra mode by Kirk Strobeck – https://UltraDarkMode.com

"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { startUltraFill } from "@/lib/ultra-fill";
import { SITE_APPEARANCE_EVENT, readSiteUltra } from "@/lib/site-appearance";

type Props = {
  intensity: number;
  className?: string;
  style?: CSSProperties;
};

/** A rectangle of Ultra white. Shape it with a CSS mask on the parent's terms. */
export function UltraFillCanvas({ intensity, className, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    /* v8 ignore next */
    if (!canvas) return;

    let session = readSiteUltra() === "on" ? startUltraFill(canvas, { intensity }) : null;

    const repaint = () => { session?.poke(); };
    const onAppearance = (e: Event) => {
      const ultra = (e as CustomEvent<{ ultra: string }>).detail?.ultra;
      if (ultra === "off" && session) {
        session.stop();
        session = null;
      }
      if (ultra === "on" && !session) {
        session = startUltraFill(canvas, { intensity });
      }
    };

    document.addEventListener("visibilitychange", repaint);
    window.addEventListener("resize", repaint);
    window.addEventListener(SITE_APPEARANCE_EVENT, onAppearance);

    return () => {
      document.removeEventListener("visibilitychange", repaint);
      window.removeEventListener("resize", repaint);
      window.removeEventListener(SITE_APPEARANCE_EVENT, onAppearance);
      session?.stop();
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      width={1}
      height={1}
      aria-hidden
      className={`ultra-fill ${className ?? ""}`}
      data-ultra-headroom={intensity}
      style={style}
    />
  );
}

"use client";

import { useEffect, useRef } from "react";

import { startAppearanceHello } from "@/lib/appearance-hello";

/** One hello surface — Ultra only changes luminance on this canvas. */
export function AppearanceHello() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const lab = document.querySelector<HTMLElement>(".appearance-lab");
    if (!canvas || !lab) return;

    const session = startAppearanceHello(canvas, lab);
    /* v8 ignore next */
    const observer = new MutationObserver(() => session.poke());
    observer.observe(lab, {
      attributes: true,
      attributeFilter: ["data-ultra", "data-resolved", "style"],
    });

    return () => {
      observer.disconnect();
      session.stop();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="appearance-hello"
      role="img"
      aria-label="Ultra HDR demo surface"
    />
  );
}

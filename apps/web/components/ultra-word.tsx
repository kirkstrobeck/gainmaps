// Ultra mode by Kirk Strobeck – https://UltraDarkMode.com

"use client";

import { useLayoutEffect, useId, useRef, useState, type CSSProperties } from "react";

import { foundationHeadroomFor } from "@/lib/text-ultra";
import { ultraOverlayGeometry } from "@/lib/ultra-overlay";

import { UltraFillCanvas } from "./ultra-fill-canvas";

type Props = {
  text: string;
  /** Typography shared by the readable text and the SVG mask. */
  typeClassName: string;
  intensity: number;
};

type MaskLine = { text: string; x: number; y: number };

type Typography = Pick<CSSProperties,
  "fontFamily" | "fontFeatureSettings" | "fontKerning" | "fontSize" | "fontStyle"
  | "fontVariant" | "fontVariationSettings" | "fontWeight" | "letterSpacing" | "wordSpacing"
>;

function measuredLines(textNode: Text, overlay: SVGSVGElement): MaskLine[] {
  const words = Array.from(textNode.data.matchAll(/\S+(?:\s+|$)/g));
  const overlayBox = overlay.getBoundingClientRect();
  const lines = new Map<number, MaskLine>();

  for (const word of words) {
    const range = document.createRange();
    const index = word.index as number;
    range.setStart(textNode, index);
    range.setEnd(textNode, index + word[0].length);
    const box = range.getBoundingClientRect();
    const key = Math.round(box.top / 2) * 2;
    const existing = lines.get(key);
    lines.set(key, {
      text: `${existing?.text ?? ""}${word[0]}`,
      x: existing?.x ?? box.left - overlayBox.left,
      y: existing?.y ?? box.top + box.height / 2 - overlayBox.top,
    });
  }

  return Array.from(lines.values()).map((line) => ({ ...line, text: line.text.trimEnd() }));
}

function typographyFor(element: HTMLElement): Typography {
  const style = getComputedStyle(element);
  return {
    fontFamily: style.fontFamily,
    fontFeatureSettings: style.fontFeatureSettings,
    fontKerning: style.fontKerning as React.CSSProperties["fontKerning"],
    fontSize: style.fontSize,
    fontStyle: style.fontStyle,
    fontVariant: style.fontVariant,
    fontVariationSettings: style.fontVariationSettings,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
    wordSpacing: style.wordSpacing,
  };
}

/*
  The HTML text stays readable at all times. SVG <text> nodes provide the mask
  content because foreignObject is not painted inside Chromium mask resources.
  Their positions come from the browser's own wrapped text layout, so each mask
  line follows the selectable text rather than forcing a single SVG line.
*/
export function UltraWord({ text, typeClassName, intensity }: Props) {
  const maskId = `ultra-word-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const maskInsetId = `${maskId}i`;
  const maskBlurId = `${maskId}b`;
  const readableRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const [lines, setLines] = useState<MaskLine[]>([]);
  const [typography, setTypography] = useState<Typography>({});
  const mask = `url(#${maskId})`;
  const maskInset = `url(#${maskInsetId})`;
  const maskBlur = `url(#${maskBlurId})`;
  const overlay = ultraOverlayGeometry();
  const foundationIntensity = foundationHeadroomFor(intensity);

  useLayoutEffect(() => {
    const readable = readableRef.current as HTMLSpanElement;
    const svg = overlayRef.current as SVGSVGElement;
    const textNode = readable.firstChild as Text;

    const measure = () => {
      setLines(measuredLines(textNode, svg));
      setTypography(typographyFor(readable));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(readable);
    window.addEventListener("resize", measure);
    measure();
    document.fonts?.ready?.then(measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [text, typeClassName]);

  return (
    <span className="ultra-word relative isolate inline-block overflow-clip">
      <span ref={readableRef} className={`${typeClassName} relative z-0 text-[var(--foreground)]`}>{text}</span>

      <svg ref={overlayRef} aria-hidden className="pointer-events-none select-none ultra-mask-defs" style={overlay}>
        <defs>
          <filter id={maskBlurId} x="-4%" y="-4%" width="108%" height="108%">
            <feGaussianBlur stdDeviation="0.3" />
          </filter>
          <mask id={maskId}>
            {lines.map((line, index) => (
              <text key={`${line.x}-${line.y}-${index}`} x={line.x} y={line.y} dominantBaseline="central" fill="#ffffff" style={typography}>
                {line.text}
              </text>
            ))}
          </mask>
          {/* 0.5px inset: SVG paint-order is fill-then-stroke, so a 1px black stroke centred on the
              glyph outline erases 0.5px inward, shrinking the ultra fill away from the antialiased edge */}
          <mask id={maskInsetId}>
            {lines.map((line, index) => (
              <text key={`${line.x}-${line.y}-${index}`} x={line.x} y={line.y} dominantBaseline="central" fill="#ffffff" stroke="#000000" strokeWidth={1} filter={maskBlur} style={typography}>
                {line.text}
              </text>
            ))}
          </mask>
        </defs>
      </svg>

      <UltraFillCanvas intensity={foundationIntensity} className="pointer-events-none ultra-fill-foundation" style={{ ...overlay, mask, WebkitMask: mask }} />
      <UltraFillCanvas intensity={intensity} className="pointer-events-none ultra-fill-inner" style={{ ...overlay, mask: maskInset, WebkitMask: maskInset }} />
    </span>
  );
}

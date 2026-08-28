export const ULTRA_HEADING_PROMPT = `/* paste this exact text into any coding agent */

You are adding an Ultra HDR text effect to a heading on this page.

The effect must stay accessible and polished: keep real visible DOM text in the document, then use SVG masks and WebGPU canvas layers for the Ultra rendering. The anti-crispy treatment is part of the implementation, not optional polish. Do not make the text transparent and do not replace the text with canvas-only rendering.

The implementation uses four absolutely stacked pieces:
1. A real visible <span> with the heading text and your font classes (colour text-[var(--foreground)], not text-transparent)
2. An SVG overlay (position:absolute, inset:-50%, width:200%, height:200%) containing TWO masks built from measured DOM text layout:
   - maskId: full glyph outline — feeds the foundation canvas
   - maskInsetId: 0.5 px inset (a 1 px black stroke centred on the glyph outline erases the outer 0.5 px) — feeds the brighter inner UltraFillCanvas
3. A sharp WebGPU foundation canvas masked to maskId at 75% of the specified text headroom, so the edge does not fall all the way back to SDR white
4. A brighter WebGPU canvas masked to maskInsetId. Apply an SVG feGaussianBlur stdDeviation="0.3" only to the inner mask text, not to the canvas element and not to the outer mask, so the outside edge stays sharp while the brightest inner shape is softened

Dependencies needed:
- A WebGPU canvas component that calls \`startUltraFill(canvas, { intensity })\`
- \`startUltraFill\` creates a GPUDevice, a 1×1 rgba16float texture, sets \`toneMapping: { mode: "extended" }\`, and writes a value > 1.0 every animation frame
- TEXT_ULTRA_FOUNDATION_RATIO = 0.75, foundationHeadroomFor(headroom), and TEXT_ULTRA_INTENSITY = 4.0

CSS gate: .ultra-fill { display: none } by default; html[data-ultra="on"] .ultra-fill { display: block }

The html[data-ultra] attribute is toggled by the site appearance system.

CRITICAL — Never animate ultra text (rule 1):
Do NOT apply any entrance animation, scroll-driven animation-timeline, or opacity/transform transition to the UltraWord element or any of its ancestors. An rgba16float canvas composited through an opacity or transform animation is tone-mapped into SDR range — the Ultra effect is destroyed and glyph edges crawl with visible banding. This is a structural incompatibility; no duration or easing value fixes it. Tailwind animate-* utilities on the word or any wrapping element are also prohibited.

If this repo already has UltraWord, UltraFillCanvas, ultra-fill.ts, and ultraOverlayGeometry() — use them directly. If not, implement the above pattern from scratch.

Target heading: [replace with the specific h1/h2 text and file path]
Font classes to reuse: [replace with your Tailwind font classes]`.trim();

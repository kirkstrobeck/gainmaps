---
name: ultra-text
description: Add Ultra-white HDR letterforms to headlines and logotypes — WebGPU canvases paint above SDR reference white using HDR headroom; the text layer stays real, selectable, and copyable. Reach for this skill when the task involves an Ultra white headline, a glowing logotype, displaying above SDR on HDR displays, or wiring up WebGPU-backed canvases masked to letterforms. Works with any coding agent that supports the skills convention.
---

# Ultra Text Agent Skill

Renders display-only Ultra-white letterforms using an accessible mask-and-canvas stack:
1. **Real visible text** — real DOM text, colour `text-[var(--foreground)]`. Stays selectable, copyable, and accessible.
2. **SVG masks** — an `<svg>` overlay containing full-glyph and 0.5 px inset masks built from the browser measured text layout.
3. **Foundation canvas** — a sharp 1×1 WebGPU `rgba16float` canvas masked to the full glyph at 75% of the specified text headroom, avoiding a harsh Ultra-to-SDR edge.
4. **Inner canvas** — a brighter WebGPU canvas masked to the 0.5 px inset glyph. The SVG inner mask text alone has `feGaussianBlur stdDeviation="0.3"`; the outer mask and canvas element stay sharp.

## Never animate ultra text

Ultra text is WebGPU `rgba16float` canvas content masked to letterforms and layered with real DOM text. **Never animate it or any ancestor element.** Specifically prohibited:

- Entrance animations (`opacity` 0→1, `translateY` → none, `@keyframes`)
- Scroll-driven timelines (`animation-timeline: view()`, `animation-range`)
- Any `opacity` or `transform` transition on the word container or its ancestors
- Tailwind `animate-*` utilities on the word or any wrapping element

**Why:** When an opacity or transform animation is applied to an ancestor, the browser composites the HDR canvas into an intermediate SDR layer. The `rgba16float` values above 1.0 are tone-mapped to SDR range, erasing the Ultra effect. The SVG mask also resamples against subpixel transform offsets, producing visible crawling and banding at glyph edges. This is a structural incompatibility; no duration or easing value fixes it.

Hover/focus `transition` on SDR chrome elements that do **not** contain `UltraWord` is fine.

## Anti-crispy rendering details

This is not just a mask. The current treatment avoids brittle, jagged, or crispy edges by combining four details:

- The full glyph gets a sharp foundation canvas at 75% of the requested headroom, so the edge transitions from high Ultra to lower Ultra instead of Ultra to SDR.
- The brightest inner canvas is inset by 0.5 px using a 1 px centered black stroke in the inner SVG mask.
- The 0.3 px blur is applied only to the SVG inner mask text with `feGaussianBlur`, not to the canvas element and not to the outer mask.
- The foundation layer stays below the inner canvas, and the hidden SVG mask definitions never paint above the visible layers.

## Reference implementation

An agent skill installable via `npx skills add kirkstrobeck/gainmaps`. This is the recommended path because the rendering stack includes edge-treatment details that can be updated over time as the implementation improves. Works with any coding agent that supports the skills convention.

Bundled source lives in `src/` alongside this file:

| File | Role |
|---|---|
| `src/ultra-word.tsx` | Accessible mask-and-canvas component. Accepts `text`, `typeClassName`, `intensity`. |
| `src/ultra-fill-canvas.tsx` | Renders the WebGPU canvas rectangle. Restarts on appearance-change events. |
| `src/ultra-fill.ts` | `startUltraFill(canvas, { intensity })` — WebGPU session, 1×1 `rgba16float` surface, `toneMapping: { mode: "extended" }`. |
| `src/text-ultra.ts` | Constants and helpers: `TEXT_ULTRA_FOUNDATION_RATIO = 0.75`, `foundationHeadroomFor()`, `TEXT_ULTRA_INTENSITY = 4.0`, `TEXT_ULTRA_HEADROOM_MIN/MAX`. |
| `src/ultra-overlay.ts` | `ultraOverlayGeometry()` — returns `position:absolute; inset:-50%; width:200%; height:200%` so ink that escapes the text box still has mask. |
| `src/global.d.ts` | WebGPU type declarations needed by `ultra-fill.ts`. |
| `src/site-appearance.ts` | Minimal stub: `SITE_APPEARANCE_EVENT` plus `readSiteUltra()`. Replace with your project appearance system if needed. |
| `src/ultra.css` | CSS gate and layer order for `.ultra-fill-foundation` and `.ultra-fill-inner`. |

## How the layers work

```tsx
<span className="ultra-word relative isolate inline-block overflow-clip">
  <span ref={readableRef} className={`${typeClassName} relative z-0 text-[var(--foreground)]`}>
    {text}
  </span>

  <svg aria-hidden className="pointer-events-none select-none ultra-mask-defs" style={overlay}>
    <defs>
      <filter id={maskBlurId} x="-4%" y="-4%" width="108%" height="108%">
        <feGaussianBlur stdDeviation="0.3" />
      </filter>
      <mask id={maskId}>{/* full glyph text */}</mask>
      <mask id={maskInsetId}>{/* 0.5 px inset text with strokeWidth={1} and filter={maskBlur} */}</mask>
    </defs>
  </svg>

  <UltraFillCanvas intensity={foundationHeadroomFor(intensity)} className="ultra-fill-foundation"
    style={{ ...overlay, mask: `url(#${maskId})`, WebkitMask: `url(#${maskId})` }} />
  <UltraFillCanvas intensity={intensity} className="ultra-fill-inner"
    style={{ ...overlay, mask: `url(#${maskInsetId})`, WebkitMask: `url(#${maskInsetId})` }} />
</span>
```

## Adding Ultra text to a page

### 1. Enable the `data-ultra` attribute on `<html>`

The CSS gates `ultra-fill` visibility on `html[data-ultra="on"]`. Set it with your site appearance system or server-render it:

```tsx
<html data-ultra="on" data-mode="dark">
```

### 2. Use `UltraWord`

```tsx
import { UltraWord } from "@/components/ultra-word";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";

<h1>
  <UltraWord
    text="Ultra"
    typeClassName="font-display text-5xl font-black tracking-normal"
    intensity={TEXT_ULTRA_INTENSITY}
  />
</h1>
```

`typeClassName` is applied to both the visible `<span>` and the SVG `<text>` nodes, so CSS font metrics drive both layers identically.

### 3. Copy the required files

Copy from `src/`:
- `src/ultra-word.tsx`
- `src/ultra-fill-canvas.tsx`
- `src/ultra-fill.ts`
- `src/text-ultra.ts`
- `src/ultra-overlay.ts`
- `src/global.d.ts`
- `src/site-appearance.ts`
- `src/ultra.css`

### 4. Intensity values

`TEXT_ULTRA_FOUNDATION_RATIO = 0.75` makes `foundationHeadroomFor(intensity)` paint the full glyph at 75% of the specified text headroom. `TEXT_ULTRA_INTENSITY = 4.0` paints the inset inner glyph at max headroom. On an HDR display these map above SDR reference white; on SDR they clamp to white. Headroom range: 1.0 to 4.0.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Word is invisible | `data-ultra` is not `"on"` on `<html>` |
| Edge contrast is too harsh | The low-headroom `ultra-fill-foundation` canvas is missing or below SDR white |
| Bright edge is cracked or jagged | The inner mask is missing `strokeWidth={1}` or its SVG-only `feGaussianBlur stdDeviation="0.3"` |
| Glyphs drift off the word | `typeClassName` differs between the `<span>` and `<text>` |
| WebGPU not available | Browser lacks WebGPU; canvas marks itself `data-ultra-fill="unsupported"` |
| Text copied twice | The SVG `<text>` lacks `select-none` or `aria-hidden` |
| Glyph edges crawl, band, or flicker | Something is animating the word or an ancestor. Remove opacity, transform, and scroll-driven animation. |

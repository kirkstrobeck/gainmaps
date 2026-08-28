# Gainmaps Design System

Product Hunt education landing — professional, warm, and teaching-first. The Ultra brighter-than-white wordmark is the signature; everything else supports clarity and conversion.

**Variance 7 · Motion 6 · Density 3** — expressive type and copper accents, restrained motion (CSS only), generous whitespace with sparse first-viewport content.

---

## Color

Charcoal and ice neutrals with one accent. No purple, no cream/terracotta pairs, no broadsheet editorial palette.

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--background` | `#F4F6F8` | `#14171B` | Page ground (ice / charcoal) |
| `--foreground` | `#1A1D21` | `#EEF1F4` | Primary text |
| `--muted` | `#5C6570` | `#8B939E` | Secondary text |
| `--border` | `#D8DEE4` | `#2A3038` | Dividers, outlines |
| `--panel` | `#FFFFFF` | `#1C2026` | Cards, surfaces |
| `--panel-strong` | `#E8EDF2` | `#252B33` | Elevated / hover |
| `--accent` | `#C4723A` | `#C4723A` | Signal copper — links, marks, focus |
| `--accent-foreground` | `#FFFFFF` | `#FFFFFF` | Text on accent |
| `--danger` | `#C0392B` | `#E57373` | Errors |
| `--success` | `#2E7D5A` | `#6BCB9A` | Success states |
| `--wash-top` | copper 8% mix | copper 12% mix | Hero gradient wash |

HDR (`color-hdr`) lifts `--hdr-accent` and panel whites when Ultra is on — copper glow in highlights, ice panels lifted past SDR white.

---

## Type

| Role | Family | Weight | Notes |
|------|--------|--------|-------|
| Display | **Syne** (`--font-syne`) | 700–800 | Headlines, nav wordmark, section titles |
| Body | **DM Sans** (`--font-dm-sans`) | 400–500 | Paragraphs, UI, tables |
| Mono | system mono | 400 | Code snippets (brew copy) |

Not used: Fraunces, Instrument Serif, Geist (display).

Display classes: `font-display`. Body inherits from `body`. Tracking: normal on display; body at default DM Sans metrics.

**Scale:**
| Context | Size | Notes |
|---------|------|-------|
| Hero UltraWord | `text-6xl sm:text-7xl lg:text-8xl` | Product name — Syne 800 |
| Gallery / doc page h1 | `text-5xl sm:text-6xl` | `leading-[1.03]` |
| Section h2 | `text-2xl` | `font-bold` — below-fold anchors |
| Hero text proof | `text-4xl sm:text-5xl` | Standard → Ultra side-by-side |
| Body lead | `text-base leading-7` | `max-w-2xl` measure |
| Secondary body | `text-sm leading-7` | Sections, table cells |

Body `line-height: 1.6` set on `body` in globals.css — component `leading-7` classes override where tighter control is needed.

---

## Layout

- **Max width:** `max-w-7xl` content, centered.
- **Nav:** 64px sticky top bar (`sticky top-0 z-40`); translucent blur backdrop; copper lightning mark when HDR-capable.
- **Home hero (first viewport only):** fits `min-h-[calc(100dvh-4rem)]` — full-bleed atmospheric backdrop (opacity-40) behind a **two-column grid on lg** (stacked on mobile). Left column: eyebrow badge → UltraWord “Gainmaps” → tagline → Standard→Ultra text pair. Right column: `PhotoPair` (card size) for explicit photo proof + `PhotoCredit`. No HomeDropZone above the fold.
  - **Backdrop photo:** `a-silhouette-stands-before-a-cloudy-sunset` — rendered at 40% opacity so it recedes behind the PhotoPair proof.
  - **Proof photo:** `zebras-in-a-golden-sunlit-grassy-field` — golden highlights that visibly lift on HDR displays.
  - **Dual-layer backdrop:** SDR `<Image>` (Next.js optimised) always rendered as fallback. Gainmap plain `<img>` (bypasses Next.js optimizer to preserve gain map bytes) sits above it with class `gainmap-image hero-ultra-layer`. CSS fades the gainmap layer out when `html[data-ultra=”off”]`; instant return when Ultra turns back on. Dynamic-range-limit governed by `.gainmap-image` rule.
  - **Directional scrim:** `var(--background)` throughout — ice in light mode, charcoal in dark; fully mode-aware, no hardcoded values.
- **First below-fold section:** “Try it” — `bg-[var(--panel)]` banner with a short heading, one-line copy, and `HomeDropZone` as the conversion CTA.
- **Below fold:** HDR primer, naming table, image compares, CLI brew block, Product Hunt link.
- **Spacing:** Density 3 — section gaps `space-y-20`, inner `gap-6`, panels `p-6`–`p-8`.
- **Radius:** `--radius: 10px`; hero drop zone `calc(var(--radius) * 1.5)`.

---

## Signature

1. **UltraWord** — WebGPU fill past SDR reference white; the product demo in the headline.
2. **Signal copper** — single accent on mark, selection, hover borders, CTA secondary emphasis.
3. **Standard → Ultra pair** — always visible in hero (text), `/logos`, and `/photos`; teaches the value prop instantly.
4. **Photos (`/photos`)** — Unsplash photographs, 12 per page. Both Standard and Ultra live in Supabase Storage under `static/gainmaps.com/photos/{slug}/` (`standard-400/800/1280.jpg` and `gainmap-400/800/1280.jpg`). Standard is the SDR primary extracted from the gain map file via our CLI (`gainmap extract-sdr`) — not an Unsplash hotlink and not a separate re-encode. Both sides share identical pixel dimensions at every breakpoint. Ultra is served `unoptimized` so Next.js does not re-encode and strip the gain map. Rebuild with `npx tsx tools/photos/build-photos.ts`.
5. **Local funnel** — home drop zone routes to `/convert`; no upload, no server.
6. **Mingcute icons**, **brew copy**, **Product Hunt** link, **Kirk footer** — retained chrome.

Motion: CSS `@keyframes` and `animation-timeline: view()` only — no JS animation libraries.

| Token | Value | Use |
|-------|-------|-----|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Expo-out for entrances |

**Keyframes:**
- `hero-rise` — 0.55s `var(--ease-out)`, opacity + translateY(12px); staggered 0.08s per child on `.hero-stage > *:nth-child(n)`.
- `reveal-rise` — `animation-timeline: view()`, `entry 0% entry 32%`, linear (timeline-driven); opacity + translateY(8px). Applied via `.reveal` class to below-fold sections.

**Rules:**
- No infinite loops anywhere on the page (drop-pulse removed). Continuous motion competes with UltraWord.
- Hover transitions use Tailwind `transition` default (150ms ease-in-out) — consistent across nav, gallery cards, links.
- All animations fully disabled under `prefers-reduced-motion: reduce` via the blanket `0.01ms` override.

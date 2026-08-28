# r4 Report — Logos ~100 Brands + Photos toward 100

## Counts

| Metric | Value |
| --- | --- |
| COMPANIES.length | 91 |
| PHOTOS.length | 100 |
| Logo dirs under public/logos | 91 |
| Photo dirs under public/photos | 100 |

## Logo Build

`npx tsx tools/logos/build-logos.ts` ran against 101 seeds in `tools/logos/sources.ts`
(Interbrand Best Global Brands 2025 top 100 + Monster placeholder).

**Built: 91 brands**
**Skipped: 10 brands**

### Skipped brands

| Rank | Slug | Reason |
| ---: | --- | --- |
| 11 | hermes | HTTP 404 from SVG source |
| 35 | pampers | no premium SVG found |
| 52 | cartier | no premium SVG found |
| 57 | rolex | no premium SVG found |
| 64 | wechat | no premium SVG found |
| 70 | monster | no premium SVG found (placeholder by design) |
| 77 | hennessy | no premium SVG found |
| 84 | jack-daniels | no premium SVG found |
| 85 | danone | no premium SVG found |
| 87 | john-deere | no premium SVG found |

## logoGainmapSrcset 1024 Size

The `logoGainmapSrcset` function in `apps/web/lib/logos/companies.ts` already included
1024 before the build ran; the regenerated file retains:
`[128, 256, 512, 1024].map(w => \`/logos/${company.slug}/logo-gainmap-${w}.jpg ${w}w\`)`

## Photos

`tools/photos/bulk-find.ts` (new script) searched 50 Unsplash napi queries across 2 pages
each (~1470 unique landscape candidates), measured luma (Rec.709, long-edge 640 → 320
inside-fit), and found 100 photos clearing the selection bar:
`p99Luma >= 0.95 AND whiteFrac >= 0.05`.

74 new photos were added to `apps/web/lib/photos/catalog.ts` (from 26 → 100).

`npx tsx tools/photos/build-photos.ts` downloaded and encoded all 74 new slugs at widths
[400, 800, 1280, 1600, 2048, 2560] — both standard (SDR) and gainmap (Ultra HDR) JPEGs.

`npx tsx tools/photos/gen-intrinsic-sizes.ts` wrote 100 entries to
`apps/web/lib/photos/intrinsic-by-slug.ts`.

## Build Result

`pnpm build` completed clean with:
- `/logos/[slug]`: 91 paths (Apple, Microsoft, Amazon, … +88 more)
- `/photos/[slug]`: 100 paths

## Test Result

`pnpm test` was running at report-creation time (vitest unit suite).
See commit for final test status.

## New Scripts

- `tools/photos/bulk-find.ts` — bulk high-key photo search with 50 queries, measures all
  candidates, outputs all PASS catalog objects
- `tools/photos/add-to-catalog.ts` — parse CATALOG lines from bulk-find output and insert
  into catalog.ts

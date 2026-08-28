# GOAL.md L48 — photo pair parity across ALL slugs

## What changed

- `apps/web/test/lib/photo-file-parity.test.ts` now enumerates every directory under `apps/web/public/photos/` (no hand-maintained slug list). Each slug is asserted at 400/800/1280 plus the `standard.jpg` / `gainmap.jpg` aliases: `format === "jpeg"`, width equal, height equal, both > 0. Missing files fail by name. The three historically broken orientations stay labeled: portrait / panorama / landscape.
- `apps/web/DESIGN.md` no longer claims Standard is an Unsplash `next/image` hotlink.
- 12 leftover slug dirs (on disk, not in `catalog.ts`) had gain maps but no Standard siblings. Standard was extracted with our CLI (`packages/gainmap/dist/cli.js extract-sdr`), the same step `encode-variants.ts` uses. `catalog.ts` was not touched. `build-photos.ts --force` only walks catalog entries, so it cannot rebuild these 12.

## Slug directories discovered

```
$ ls -1 apps/web/public/photos | wc -l
38
```

```
$ ls -1 apps/web/public/photos
a-clear-chunk-of-ice-on-a-dark-pebble-beach-near-the-ocean
a-lake-in-the-middle-of-a-mountain-range
a-person-in-a-red-cloak-on-a-vast-sand-dune-at-golden-hour
a-person-looking-out-over-a-lake-and-mountains-from-a-metal
a-person-walks-along-a-desert-sand-dune-at-sunset
a-seal-rests-on-a-shallow-sandbar-in-calm-water
a-silhouette-stands-before-a-cloudy-sunset
a-solitary-egret-stands-in-misty-morning-light-by-reeds
a-turquoise-volcanic-crater-lake-surrounded-by-rocky-cliffs
a-view-of-a-beach-with-waves-coming-in-to-shore
a-view-of-a-body-of-water-from-a-hill
aerial-photo-body-of-water
an-aerial-view-of-a-snow-covered-mountain
black-and-white-mountains-under-white-sky-during-daytime
black-and-white-ocean-waves-crashing-against-a-rocky-shore
body-of-water-near-trees-and-mountain-cliff-during-daytime
field-of-brown-grasses-within-mountain-range
full-moon-in-a-clear-blue-sky-above-buildings
green-grass-field-and-mountains-under-white-clouds-and-blue-sky
green-mountains-under-blue-sky-during-daytime
green-pine-trees
green-trees-and-snow-covered-mountains-during-daytime
grey-and-white-mountain
historic-white-church-building-on-a-sandy-dune-landscape
landscape-photography-of-mountain-ranges-under-purple-and-pink
large-waves-crash-against-dark-rocks-under-a-grey-sky
low-sun-with-lens-flare-over-a-forested-valley-and-granite-c
people-on-a-grassy-hillside-with-a-wooden-mountain-hut-below
photo-of-sea-wave-crashing-shore
red-tent-on-grass-field-beside-ice-capped-mountain-nature-photo
silhouettes-of-people-against-a-bright-low-sun-in-a-clear-sk
snow-capped-mountains-at-daytime
striking-layered-desert-mountain-under-a-beautiful-sunset-sk
turquoise-river-flows-through-a-dramatic-rocky-canyon
turquoise-waves-crashing-on-a-sandy-shore
wooden-cabin-in-a-lush-green-meadow-before-a-mountain
yellow-house-with-wooden-shutters-and-mountain-in-background
zebras-in-a-golden-sunlit-grassy-field
```

38 dirs × (1 eight-file check + 3 widths + 1 alias) + 1 discovery + 3 orientation presence tests = 194 tests.

## First run (before extract-sdr) — 12 leftover slugs missing Standard files

The missing-file assertion names the slug and the files. Example:

```
 FAIL  test/lib/photo-file-parity.test.ts > shipped photo file parity (decoded pixels) > a-clear-chunk-of-ice-on-a-dark-pebble-beach-near-the-ocean > ships all eight expected files
AssertionError: slug a-clear-chunk-of-ice-on-a-dark-pebble-beach-near-the-ocean is missing standard-400.jpg, standard-800.jpg, standard-1280.jpg, standard.jpg: expected [ 'standard-400.jpg', …(3) ] to deeply equal []
```

```
 Test Files  1 failed (1)
      Tests  60 failed | 134 passed (194)
```

No catalog slug failed pixel parity. Failures were the 12 leftover dirs × 5 tests = 60. Standard was then extracted with:

```
node packages/gainmap/dist/cli.js extract-sdr <gainmap-w.jpg> -o <tmp> --force --no-update-check
```

copied to `standard-<w>.jpg` (and `standard.jpg` at 1280).

## Parity test after extract — judge Tests N passed, not exit code

Command: `cd apps/web && pnpm exec vitest run test/lib/photo-file-parity.test.ts --coverage`

```
 RUN  v4.1.10 /workspace/apps/web
      Coverage enabled with v8


 Test Files  1 passed (1)
      Tests  194 passed (194)
   Start at  19:24:31
   Duration  14.36s (transform 323ms, setup 548ms, import 264ms, tests 8.72s, environment 1.94s)
```

A one-file vitest run always trips the global 100% coverage thresholds. I am reading **Tests 194 passed (194)**, not the coverage exit code. Coverage summary from that same run:

```
ERROR: Coverage for lines (0%) does not meet global threshold (100%)
ERROR: Coverage for functions (0%) does not meet global threshold (100%)
ERROR: Coverage for statements (0%) does not meet global threshold (100%)
ERROR: Coverage for branches (0%) does not meet global threshold (100%)
```

## Decoded width × height (sharp) — five slugs

portrait `a-person-in-a-red-cloak-on-a-vast-sand-dune-at-golden-hour`

```
  standard-400.jpg: jpeg 400x600
  gainmap-400.jpg: jpeg 400x600
  standard-800.jpg: jpeg 800x1200
  gainmap-800.jpg: jpeg 800x1200
  standard-1280.jpg: jpeg 853x1280
  gainmap-1280.jpg: jpeg 853x1280
  standard.jpg: jpeg 853x1280
  gainmap.jpg: jpeg 853x1280
```

panorama `a-seal-rests-on-a-shallow-sandbar-in-calm-water`

```
  standard-400.jpg: jpeg 400x200
  gainmap-400.jpg: jpeg 400x200
  standard-800.jpg: jpeg 800x400
  gainmap-800.jpg: jpeg 800x400
  standard-1280.jpg: jpeg 1280x640
  gainmap-1280.jpg: jpeg 1280x640
  standard.jpg: jpeg 1280x640
  gainmap.jpg: jpeg 1280x640
```

landscape `an-aerial-view-of-a-snow-covered-mountain`

```
  standard-400.jpg: jpeg 400x267
  gainmap-400.jpg: jpeg 400x267
  standard-800.jpg: jpeg 800x533
  gainmap-800.jpg: jpeg 800x533
  standard-1280.jpg: jpeg 1280x853
  gainmap-1280.jpg: jpeg 1280x853
  standard.jpg: jpeg 1280x853
  gainmap.jpg: jpeg 1280x853
```

`zebras-in-a-golden-sunlit-grassy-field`

```
  standard-400.jpg: jpeg 400x267
  gainmap-400.jpg: jpeg 400x267
  standard-800.jpg: jpeg 800x533
  gainmap-800.jpg: jpeg 800x533
  standard-1280.jpg: jpeg 1280x853
  gainmap-1280.jpg: jpeg 1280x853
  standard.jpg: jpeg 1280x853
  gainmap.jpg: jpeg 1280x853
```

`wooden-cabin-in-a-lush-green-meadow-before-a-mountain`

```
  standard-400.jpg: jpeg 400x600
  gainmap-400.jpg: jpeg 400x600
  standard-800.jpg: jpeg 800x1200
  gainmap-800.jpg: jpeg 800x1200
  standard-1280.jpg: jpeg 853x1280
  gainmap-1280.jpg: jpeg 853x1280
  standard.jpg: jpeg 853x1280
  gainmap.jpg: jpeg 853x1280
```

After extract, leftover slug `a-silhouette-stands-before-a-cloudy-sunset` (hero backdrop, not in current catalog):

```
  standard-400.jpg: jpeg 400x533
  gainmap-400.jpg: jpeg 400x533
  standard-800.jpg: jpeg 800x1067
  gainmap-800.jpg: jpeg 800x1067
  standard-1280.jpg: jpeg 960x1280
  gainmap-1280.jpg: jpeg 960x1280
  standard.jpg: jpeg 960x1280
  gainmap.jpg: jpeg 960x1280
```

No slug failed dimension parity after Standard files existed. Nothing was deleted from the test to go green.

## DESIGN.md before / after

Before:

```
4. **Photos (`/photos`)** — 100 Unsplash photographs, 12 per page. Standard uses `next/image` against `images.unsplash.com` (optimizer OK). Ultra uses `next/image` with `unoptimized` pointing at local `/photos/{slug}/gainmap.jpg`. The optimizer re-encodes JPEGs and would strip the gain map; `unoptimized` still gives layout, lazy loading, and `sizes`, but the bytes pass through. Rebuild with `npx tsx tools/photos/build-photos.ts`.
```

After:

```
4. **Photos (`/photos`)** — Unsplash photographs, 12 per page. Both Standard and Ultra are local siblings under `/photos/{slug}/` (`standard-400/800/1280.jpg` and `gainmap-400/800/1280.jpg`, plus `standard.jpg` / `gainmap.jpg` aliases). Standard is the SDR primary extracted from the gain map file via our CLI (`gainmap extract-sdr`) — not an Unsplash hotlink and not a separate re-encode. Both sides share identical pixel dimensions at every breakpoint. Ultra is served `unoptimized` so Next.js does not re-encode and strip the gain map. Rebuild with `npx tsx tools/photos/build-photos.ts`.
```

## `pnpm --filter web test`

```
$ pnpm --filter web test
> @gainmaps/web@1.0.0 test /workspace/apps/web
> NODE_OPTIONS=--max-old-space-size=8192 vitest run --coverage

 Test Files  85 passed (85)
      Tests  767 passed (767)
   Start at  19:29:10
   Duration  129.13s (transform 3.73s, setup 20.44s, import 5.44s, tests 17.39s, environment 60.08s)

All files          |   99.92 |    99.86 |     100 |     100 |
 lib/logos         |      90 |       50 |     100 |     100 |
  logo-strip.ts    |      80 |       50 |     100 |     100 | 5

ERROR: Coverage for statements (99.92%) does not meet global threshold (100%)
ERROR: Coverage for branches (99.86%) does not meet global threshold (100%)
EXIT:1
```

Every test passed. The only red is coverage thresholds on `apps/web/lib/logos/logo-strip.ts` line 5 (uncovered `companyBySlug` miss throw). That file is the other agent's in-progress 100% coverage / logos work. I did not touch `logo-strip.ts`, `catalog.ts`, `nav.ts`, `site-nav.tsx`, any `page.tsx`, any `h1`, or coverage config.

Other agent's uncommitted files left in the tree (not staged by this commit): `apps/web/lib/nav.ts`, `apps/web/components/site-nav.tsx`, `apps/web/app/error.tsx`, `apps/web/app/not-found.tsx`, `apps/web/components/site-footer.tsx`, matching tests, `apps/web/test/nav-model.test.ts`, `apps/web/test/ultra-headings.test.ts`, `apps/web/test/lib/routes.test.ts`.

## Git add scope

Staged explicitly (not `git add -A` / `.` / `-a`):

- `apps/web/test/lib/photo-file-parity.test.ts`
- `apps/web/DESIGN.md`
- `GOAL-EVIDENCE-L48.md`
- the 48 newly extracted `standard-*.jpg` / `standard.jpg` files under the 12 leftover slug dirs, without which CI would fail the all-slugs enumeration

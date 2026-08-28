# GOAL-EVIDENCE-TRUTH-CACHE

Measured at dispatch, not assumed from the prompt: `PHOTOS.length` is **26**. Disk had **38** slug dirs, so **12** orphans (the prompt’s 28/10 had already moved).

Pushed as four separate commits on `main`:

| Part | SHA | Title |
|------|-----|--------|
| 1 | `d2ac8ee` | fix(web): set Vary: Accept on HTML responses for markdown-negotiated paths |
| 2 | `59f15ed` | fix(web): derive every photo-count string from PHOTOS.length |
| 3 | `078e786` | fix(photos): make curate-photos emit the committed local-file catalog |
| 4 | `db9db5b` | fix(web): remove unreferenced photo directories that the catalog no longer ships |

---

## Part 1 — `Vary: Accept` on HTML `MARKDOWN_PATHS`

HTML `NextResponse.next()` never set `Vary`. Middleware now appends `Accept` for every path in `MARKDOWN_PATHS` via `appendVary` (does not overwrite an existing `Vary`).

### Test assertion (HTML Vary contains Accept, markdown still rewrites)

```
 ✓ test/middleware.test.ts > markdown-path HTML responses advertise Vary: Accept > / HTML Vary contains Accept 16ms
 ✓ test/middleware.test.ts > markdown-path HTML responses advertise Vary: Accept > /developers HTML Vary contains Accept 10ms
 ✓ test/middleware.test.ts > markdown-path HTML responses advertise Vary: Accept > /docs HTML Vary contains Accept 3ms
 ✓ test/middleware.test.ts > markdown-path HTML responses advertise Vary: Accept > /photos HTML Vary contains Accept 2ms
 ✓ test/middleware.test.ts > markdown-path HTML responses advertise Vary: Accept > /logos HTML Vary contains Accept 1ms
 ✓ test/middleware.test.ts > markdown-path HTML responses advertise Vary: Accept > /about HTML Vary contains Accept 1ms
 ✓ test/middleware.test.ts > markdown-path HTML responses advertise Vary: Accept > /contact HTML Vary contains Accept 1ms
 ✓ test/middleware.test.ts > markdown-path HTML responses advertise Vary: Accept > /privacy HTML Vary contains Accept 1ms
 ✓ test/middleware.test.ts > markdown Accept still rewrites MARKDOWN_PATHS > / rewrites to /api/markdown 1ms
 ✓ test/middleware.test.ts > markdown Accept still rewrites MARKDOWN_PATHS > /developers rewrites to /api/markdown 0ms
 ✓ test/middleware.test.ts > markdown Accept still rewrites MARKDOWN_PATHS > /docs rewrites to /api/markdown 0ms
 ✓ test/middleware.test.ts > markdown Accept still rewrites MARKDOWN_PATHS > /photos rewrites to /api/markdown 0ms
 ✓ test/middleware.test.ts > markdown Accept still rewrites MARKDOWN_PATHS > /logos rewrites to /api/markdown 2ms
 ✓ test/middleware.test.ts > markdown Accept still rewrites MARKDOWN_PATHS > /about rewrites to /api/markdown 4ms
 ✓ test/middleware.test.ts > markdown Accept still rewrites MARKDOWN_PATHS > /contact rewrites to /api/markdown 6ms
 ✓ test/middleware.test.ts > markdown Accept still rewrites MARKDOWN_PATHS > /privacy rewrites to /api/markdown 0ms

 Test Files  2 passed (2)
      Tests  24 passed (24)
```

No `curl -sI` against a live Next server: the process on `:3011` was started at 21:15 UTC, before `d2ac8ee`, so its HTML pages would not show the new header.

---

## Part 2 — photo-count copy

Runtime count is `PHOTOS.length` = 26.

| Surface | Before | After |
|---------|--------|--------|
| `apps/web/app/photos/page.tsx` metadata | `"One hundred Unsplash photographs, Standard SDR next to the same frame encoded as an Ultra HDR gain map."` | `` `${PHOTOS.length} Unsplash photographs, Standard SDR next to the same frame encoded as an Ultra HDR gain map.` `` |
| `apps/web/lib/page-markdown.ts` `/photos` | `shows 48 landscape photographs` | `shows ${PHOTOS.length} landscape photographs` |
| `apps/web/lib/photos/catalog.ts` header | `* 48 Unsplash photographs for /photos.` | `* Unsplash photographs for /photos.` (no count) |

### Drift test passing line

```
 ✓ test/lib/web-install-copy-drift.test.ts > web install copy drift > no surface states a photo count that disagrees with PHOTOS.length 27ms
```

---

## Part 3 — generator identity

`tools/photos/curate-photos.ts` no longer fetches toward `TARGET = 100` and no longer emits CDN hotlinks. It round-trips the committed `PHOTOS` array with local `/photos/{slug}/standard-{w}.jpg` and `gainmap-{w}.jpg` sources at `PHOTO_SRC_WIDTHS`. `build-photos.ts` / `unsplash-napi.ts` still download from `images.unsplash.com` at fetch time; that is unchanged.

```
$ npx tsx tools/photos/curate-photos.ts
Wrote /workspace/apps/web/lib/photos/catalog.ts (26 photographs, local-file sources)
$ git diff --stat apps/web/lib/photos/catalog.ts
(empty — no diff)
```

Re-ran after Part 4; still empty.

---

## Part 4 — orphan directories

```
$ du -sk apps/web/public/photos
37196	apps/web/public/photos   # before
27380	apps/web/public/photos   # after
```

12 orphans vs 26 catalog entries. Deleted 11. Kept `a-silhouette-stands-before-a-cloudy-sunset` because `apps/web/DESIGN.md:62` still names it as the hero backdrop example.

`photo-file-parity.test.ts` after deletion: **113 tests passed**. `photos-page.test.tsx`: **3 passed**. Catalog still has 26 entries; `/photos` still renders `PHOTOS.length`.

### `git grep` of each deleted slug (only historical `GOAL-EVIDENCE-L48.md`, not a fixture / OG image / live docs example)

```
----- a-clear-chunk-of-ice-on-a-dark-pebble-beach-near-the-ocean -----
GOAL-EVIDENCE-L48.md:18:a-clear-chunk-of-ice-on-a-dark-pebble-beach-near-the-ocean
GOAL-EVIDENCE-L48.md:65: FAIL  test/lib/photo-file-parity.test.ts > shipped photo file parity (decoded pixels) > a-clear-chunk-of-ice-on-a-dark-pebble-beach-near-the-ocean > ships all eight expected files
GOAL-EVIDENCE-L48.md:66:AssertionError: slug a-clear-chunk-of-ice-on-a-dark-pebble-beach-near-the-ocean is missing standard-400.jpg, standard-800.jpg, standard-1280.jpg, standard.jpg: expected [ 'standard-400.jpg', …(3) ] to deeply equal []
----- a-person-looking-out-over-a-lake-and-mountains-from-a-metal -----
GOAL-EVIDENCE-L48.md:21:a-person-looking-out-over-a-lake-and-mountains-from-a-metal
----- a-solitary-egret-stands-in-misty-morning-light-by-reeds -----
GOAL-EVIDENCE-L48.md:25:a-solitary-egret-stands-in-misty-morning-light-by-reeds
----- a-turquoise-volcanic-crater-lake-surrounded-by-rocky-cliffs -----
GOAL-EVIDENCE-L48.md:26:a-turquoise-volcanic-crater-lake-surrounded-by-rocky-cliffs
----- full-moon-in-a-clear-blue-sky-above-buildings -----
GOAL-EVIDENCE-L48.md:35:full-moon-in-a-clear-blue-sky-above-buildings
----- green-pine-trees -----
GOAL-EVIDENCE-L48.md:38:green-pine-trees
----- historic-white-church-building-on-a-sandy-dune-landscape -----
GOAL-EVIDENCE-L48.md:41:historic-white-church-building-on-a-sandy-dune-landscape
----- people-on-a-grassy-hillside-with-a-wooden-mountain-hut-below -----
GOAL-EVIDENCE-L48.md:45:people-on-a-grassy-hillside-with-a-wooden-mountain-hut-below
----- silhouettes-of-people-against-a-bright-low-sun-in-a-clear-sk -----
GOAL-EVIDENCE-L48.md:48:silhouettes-of-people-against-a-bright-low-sun-in-a-clear-sk
----- turquoise-river-flows-through-a-dramatic-rocky-canyon -----
GOAL-EVIDENCE-L48.md:51:turquoise-river-flows-through-a-dramatic-rocky-canyon
----- yellow-house-with-wooden-shutters-and-mountain-in-background -----
GOAL-EVIDENCE-L48.md:54:yellow-house-with-wooden-shutters-and-mountain-in-background
```

### Kept

```
===== KEPT a-silhouette-stands-before-a-cloudy-sunset =====
GOAL-EVIDENCE-L48.md:24:a-silhouette-stands-before-a-cloudy-sunset
GOAL-EVIDENCE-L48.md:173:After extract, leftover slug `a-silhouette-stands-before-a-cloudy-sunset` (hero backdrop, not in current catalog):
apps/web/DESIGN.md:62:  - **Backdrop photo:** `a-silhouette-stands-before-a-cloudy-sunset` — rendered at 40% opacity so it recedes behind the PhotoPair proof.
```

---

## `pnpm test:all`

`gainmap:test` and `gainmaps.com:test` cache-hit at 100% coverage (69 tests and 58 tests).

Web vitest with `NODE_OPTIONS=--max-old-space-size=16384` (the package script’s 8192 heap OOMs while merging coverage under this host’s load):

```
 Test Files  103 passed (104)
      Tests  783 passed (790)
     Errors  1 error
   Duration  752.92s

 % Coverage report from v8
Statements   : 100% ( 1585/1585 )
Branches     : 100% ( 815/815 )
Functions    : 100% ( 461/461 )
Lines        : 100% ( 1369/1369 )
ERROR: [vitest-pool]: Worker forks emitted error.
Worker exited unexpectedly
EXIT:1
```

The 7 unrun tests are `test/lib/run-hdr-queue.test.ts`. That file is unchanged by this work; the worker dies after ~14GB RSS. `pnpm test:all` using the scripted 8192 heap printed `FATAL ERROR: Reached heap limit` and never printed turbo’s `Tasks:` footer.

New/changed tests that did complete: middleware 17, append-vary 4, web-install-copy-drift 7, catalog 29, photos-page 3, photo-file-parity 113, api-markdown (including omitted-path + `markdownForPath` null), display-check non-Escape.


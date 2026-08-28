# GOAL.md L42 + L44 evidence

Inner agent run. Other agents own `apps/web/app/layout.tsx`, `apps/web/app/api/**`,
`apps/web/app/{about,contact,privacy}/**`, `apps/web/app/sitemap.ts`,
`apps/web/public/llms.txt`, `GOAL-EVIDENCE-L46.md`, and the `metadata` export
in `apps/web/app/photos/page.tsx`. Those paths were not edited here.

## Photos metadata (deliberately not fixed)

`apps/web/app/photos/page.tsx` `metadata.description` still says
**"One hundred Unsplash photographs"**. That is false: `PHOTOS.length` is 26
and there are 38 slug directories under `public/photos`. Left untouched
because another agent is adding canonical/og fields on that export.

## `/photos` srcset — what the browser actually loaded

Harness viewport is 1280×800, DPR 1.

**BEFORE** (trace against the old isolated prod on `:3010`, sizes `33vw` ≈ 422 CSS px):

Every gallery `<img>` selected the **800w** candidate
(`…/gainmap-800.jpg` and `…/standard-800.jpg`). Cards render ~384×220.
That is a ~4× pixel oversample on a CPU rasterizer (`gpuRasterOn: false`).

**AFTER** (`sizes` = `PHOTO_GALLERY_SIZES` = `(min-width: 1024px) 380px, …`,
`src` fallback is the 400w file). Playwright dump against
`http://127.0.0.1:3011/photos`:

```
count 24
…/gainmap-400.jpg nat 380 css 384   (first 9 cards, both layers)
…/standard-400.jpg nat 380 css 384
(empty src)  3 ultra layers on the last three cards (deferUltra)
```

The browser now selects **400w**. Off-screen Ultra layers have no `src` until
`IntersectionObserver` (rootMargin 200px) reports the card is near.

## Trace attribution — 549.9 ms `/photos scroll` frame

Chrome trace of the **cold** `/photos` run (old prod, 800w selected).
File was `/tmp/trace-photos-report.txt` (not committed).

Totals across the trace:

- ImageDecodeTask **698.9 ms**
- Decode LazyPixelRef **372.3 ms**
- Decode Image **360.7 ms**
- Layout **58.8 ms**, UpdateLayoutTree **25.7 ms**, Paint **54.5 ms**
- FunctionCall **1685.7 ms**, almost all in `chunks/705-*.js` (Next app-router
  client, ~173 KB). Longest RunTask **1582.9 ms** is this FunctionCall.

The 705 FunctionCall is **page-load**, before the FPS sampler starts
(`waitUntil: networkidle`). It is not the scroll-window 549.9 ms frame.

Scroll-window decode: individual ImageDecodeTask 18–43 ms; GPUTask sum
**549.2 ms**. That matches the measured worst frame: bulk CPU image decode
when a burst of `loading="lazy"` 800w JPEGs crosses the viewport.

PostHog chunk `5a4ecc01.*.js` is ~63 ms EvaluateScript on this page; not the
550 ms frame.

**Followed the trace, not a guess:** the 549.9 ms frame is Image Decode /
GPUTask on oversized JPEGs, not slider JS (seam drag was already 60.0) and
not a `.gainmap-image` effect (CSS `dynamic-range-limit` only).

Fixes applied for that cause:

1. Tighten `sizes` so srcset picks 400w at the gallery box (~384 CSS px).
2. `content-visibility: auto` + `contain-intrinsic-size: auto 280px` on
   `.photo-card`.
3. Defer the Ultra layer `src` until the card is near the viewport
   (`deferUltra` on cards after the first three). SDR stays in the DOM so
   the left of the seam still has a picture. GOAL.md L30 sliders remain.
4. `src` fallback is the 400w file, not 1280w.

`PAGE_SIZE` was left at 12 — the trace named decode volume per image, not
card count.

## Trace attribution — `/convert drop` 57.1 fps

`/tmp/trace-convert-report.txt`:

- 152 frames over 16.7 ms at mean ~57 fps = per-tick main-thread work during
  the encode, matching `updateJob` → `setJobs` rebuilding the whole queue on
  every worker progress event. Conversion itself is in the service worker.
- Separate spike inside the sample window: **EvaluateScript
  `/hdr-service-worker.js` 180 ms** at ~+2.7 s. Worst original frame 316 ms.
- Load-time FunctionCall in `705-*.js` ~1447 ms is again before/around
  navigation, not the drop sample.

Fixes:

1. `createJobUpdateCoalescer` — progress patches coalesce to one
   `requestAnimationFrame`; `done` / `error` flush immediately so the UI
   never drops the terminal state. (Vitest stubs `rAF` as `() => 1` and never
   invokes the callback, so a progress-only throttle would hang tests.)
2. `preload("/hdr-service-worker.js", { as: "script" })` on `/convert` so the
  180 ms parse moves before `networkidle` / sampler start.

## Duplicate photo bytes

All **38** slug dirs: `gainmap.jpg` ≡ `gainmap-1280.jpg` and
`standard.jpg` ≡ `standard-1280.jpg` (md5 of `git show HEAD:` alias vs on-disk
1280). **76/76 matched, 0 mismatches.** Then deleted the aliases.

```
slugs 38
checked alias-vs-1280 from HEAD 76
mismatches 0
leftover on disk []
du 37M  apps/web/public/photos     (was 62M)
```

Canonical name is `gainmap-1280.jpg` / `standard-1280.jpg`.
`photoGainmapSrc()` / `photoStandardSrc()` already pointed at the suffixed
1280 file; they no longer have an unsuffixed path. Encode/build/backfill
scripts no longer copy the alias. `photo-file-parity` now expects six width
variants and asserts no slug still ships `gainmap.jpg` / `standard.jpg`.

**Blocked (other agent owns `layout.tsx`):**

```
images: [{ url: "/photos/a-seal-rests-on-a-shallow-sandbar-in-calm-water/gainmap.jpg", ...}]
```

That OG URL 404s after the alias deletion. They must retarget it to
`gainmap-1280.jpg`.

## FPS BEFORE (from the committed `tools/fps/results.json`, isolated prod, CPU raster)

```
FAIL  /photos scroll    min 46.3   runs: 46.3  57.0  56.7   worstFrame 549.9ms (run 1)
PASS  / seam drag       min 60.0   runs: 60.0  60.0  60.0
PASS  /text idle 5s     min 60.0
PASS  / home idle 5s    min 60.0
FAIL  /convert drop     min 57.1   runs: 57.1  58.4  58.4
env: headless true, gpuRasterOn false, webGpuAvailable false, HeadlessChrome/140
```

Gate: `tools/fps/assert.ts` requires `meanFps >= 60` on **every** run.

## FPS AFTER — first attempt (INVALID — do not treat as the gate)

`pnpm -C apps/web build:isolated` was first run with the sandbox
`NODE_ENV=development`. Next printed
`You are using a non-standard "NODE_ENV" value` and the bundle was not a
true production compile. Measured on `:3011` while another agent's vitest
held **8.6 GB / 160–230% CPU**, load average **13–18**.

Idle scenarios that previously held a clean 60.0 fell to 59.4–59.6. Seam
drag (untouched, already 60.0) fell to 45. That is machine contention plus a
development compile, not a regression in the slider.

Rebuilt with `NODE_ENV=production` in `build:isolated` / `start:isolated`
(no more Next warning). Production server is on `:3011`. A clean remasure
was blocked for the rest of this run by the same 8.6 GB vitest still at
~130% CPU ten minutes in, plus a second vitest at ~110%.

`pnpm tsx tools/fps/assert.ts` was **not** exited 0 on a quiet production
build. **Do not enable `pull_request` on `fps.yml` until that remasure
passes.** The workflow is switched to `build:isolated` + `start:isolated`
(it previously started `pnpm --filter @gainmaps/web dev` on :3000) and
still `workflow_dispatch` only.

## `.github/workflows/fps.yml`

Was:

```yaml
on:
  workflow_dispatch:
# …
      - name: Start web dev server
        run: |
          pnpm --filter @gainmaps/web dev &
          npx wait-on http://127.0.0.1:3000 --timeout 120000
      - name: Measure FPS and assert ≥ 60
        env:
          FPS_BASE_URL: http://127.0.0.1:3000
```

Now: `NODE_ENV=production`, `pnpm -C apps/web build:isolated`,
`pnpm -C apps/web start:isolated`, `wait-on http://127.0.0.1:3000`.
`pull_request` is **not** live — the gate has not actually passed.

## Lighthouse (GOAL.md L42) — not finished this run

Did not re-run `lhci autorun` (Part 1 FPS remasure blocked; Part 2 follows
that). Stored Aug 25 desktop reports still show Performance as the only
category short; **no mobile run exists** in `.lighthouseci/`.

Configs visit `/`, `/convert`, `/photos`, `/docs`, `/logos`, `/text` on
`LHCI_PORT || 3000`. Unmeasured vs the live site: `/about`, `/contact`,
`/privacy`, `/community`, `/developers`, `/appearance`, `/logos/[slug]`,
`/photos/[slug]`.

Named blockers, not yet decided:

1. **bf-cache / `no-store` vs L22.** `apps/web/app/page.tsx` exports
   `dynamic = "force-dynamic"` and calls `cookies()` / `headers()` for
   last-photo rotation. `layout.tsx` (other agent) also has
   `force-dynamic`. Middleware already picks the hero and only sets the
   cookie when it changes. **Keep L22.** bf-cache is one audit. Do not
   delete rotation. The other agent would have to drop `force-dynamic` on
   `layout.tsx` before a cacheable homepage is even possible.
2. **`modern-image-formats` on gain-map JPEGs.** Must not convert to
   WebP/AVIF — the ISO 21496-1 payload is the product (L48/L50).
3. **Homepage LCP.** App code no longer hotlinks `images.unsplash.com`
   (only a comment in `catalog.ts`). Hero uses local
   `/photos/{slug}/gainmap-*.jpg` via `SeamComparePhoto`. LCP should now
   be that local file; unconfirmed without a fresh LHCI run. Part 1a's
   400w gallery sizes / `PHOTO_HERO_SIZES` (720px → 800w at DPR 1) are
   the image-weight half of this.
4. **`label-content-name-mismatch`.** `.inst-switch-btn` visible text is
   `SDR` with `aria-label="Show Standard"`. Appearance toggles use
   `aria-label` matching visible `Light`/`Dark`/`Off`/`On`; the group
   labels `"Color mode"` / `"Ultra display"` are on `role="group"`, not
   the buttons. Not fixed this run (Part 2).
5. **PostHog / chunk 705 TBT swing (12 ms → 272 ms)** — still a variance
   source on `/`.

`.github/workflows/lighthouse.yml` is still `workflow_dispatch` only.
Mobile assert is still `minScore: 0.85`. Not uncommented.

## Coverage

Repo-wide `pnpm test:all` was **not** run: another agent held an 8.6 GB
vitest coverage worker the whole session, and a concurrent
`pnpm -C apps/web test` OOMs at 8 GB on this 31 GB box.

Targeted `vitest run --coverage=false` (judge by Tests N passed; filtered
runs exit 1 on global 100% thresholds):

```
test/lib/coalesce-job-updates.test.ts
test/lib/run-hdr-queue.test.ts
test/lib/near-viewport.test.tsx
test/lib/catalog.test.ts
test/components/seam-layer-img.test.tsx
test/components/hdr-processor-busy.test.tsx
test/components/seam-compare.test.tsx
test/components/seam-compare-input.test.tsx
test/app/photos-page.test.tsx
→ 9 files, 69 tests passed (10th file OOM'd under the other worker)

test/components/hero-section.test.tsx
test/components/hdr-processor.test.tsx
test/components/hdr-queue.test.tsx
→ 3 passed, 9 tests

test/lib/photo-file-parity.test.ts
test/components/seam-compare.test.tsx
→ 2 passed, 169 tests (includes all 38 slug parity cases)
```

Did not weaken thresholds, add ignore comments, or widen excludes.

A filtered run that OOM'd on heap 3 GB while the other worker lived is not
a product failure.

## What the human must decide

1. Re-run `NODE_ENV=production pnpm -C apps/web build:isolated`,
   `start:isolated`, `FPS_BASE_URL=… pnpm fps`, `pnpm tsx tools/fps/assert.ts`
   on a **quiet** CPU-only box. Then, and only then, add
   `pull_request: branches: [main]` to `fps.yml`.
2. `layout.tsx` OG image still points at deleted `gainmap.jpg`.
3. L22 vs bf-cache: keep rotation; layout `force-dynamic` is owned elsewhere.
4. Whether gain-map JPEG `modern-image-formats` / `uses-optimized-images`
   is an accepted Lighthouse miss.
5. `pnpm test:all` after the other agent's coverage worker is gone.

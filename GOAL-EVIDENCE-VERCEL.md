# GOAL-EVIDENCE-VERCEL.md

Production was failing because `apps/web` `build` wrote `NEXT_DIST_DIR=.next-prod`
while Vercel looks for `.next/routes-manifest.json`. Default `build`/`start` now
use `.next`. Isolated local prod is opt-in: `build:isolated` / `start:isolated`.

Code landed on `origin/main` in `b9f1e48` (concurrent photos agent committed the
shared working-tree paths together with luminance curation). HEAD is `94cfb00`.

`apps/web/.next-prod-OLD/` and `apps/web/.next-prod-OLD2/` were already absent.

## 1. Default build (Vercel path)

```
$ pnpm --filter @gainmaps/web build
> @gainmaps/web@1.0.0 build /workspace/apps/web
> pnpm --filter gainmap build && pnpm build:worker && next build
   ▲ Next.js 15.5.22
 ✓ Compiled successfully in 89s
 ✓ Generating static pages (49/49)

$ ls -l apps/web/.next/routes-manifest.json
-rw-r--r-- 1 agent dialout 4760 Aug 26 18:42 apps/web/.next/routes-manifest.json
```

This is the file Vercel could not find on `d79710f`.

## 2. Isolated build

First isolated run hit `EACCES` on a root-owned leftover `.next-prod`. Removed it
and reran:

```
$ pnpm --filter @gainmaps/web build:isolated
> @gainmaps/web@1.0.0 build:isolated /workspace/apps/web
> pnpm --filter gainmap build && pnpm build:worker && NEXT_DIST_DIR=.next-prod next build
   ▲ Next.js 15.5.22
 ✓ Compiled successfully in 2.6min
 ✓ Generating static pages (49/49)

$ ls -l apps/web/.next-prod/routes-manifest.json
-rw-r--r-- 1 root root 4760 Aug 26 18:50 apps/web/.next-prod/routes-manifest.json
```

## 3. Tests

```
$ pnpm test
 Test Files  8 passed | 1 skipped (9)
      Tests  57 passed | 2 skipped (59)
Statements   : 100% ( 751/751 )

$ pnpm --filter web test
 Test Files  83 passed (83)
      Tests  577 passed (577)
ERROR: Coverage for statements (99.92%) does not meet global threshold (100%)
ERROR: Coverage for branches (99.86%) does not meet global threshold (100%)
  logo-strip.ts    |      80 |       50 |     100 |     100 | 5
```

All 577 web tests passed, including `vercel-build-distdir.test.ts`. Exit 1 is
coverage on `apps/web/lib/logos/logo-strip.ts`, added in the concurrent photos
commit `b9f1e48`. Not touched here (agents were told not to edit logos/photos).

```
$ pnpm --filter gainmap test
 Test Files  14 passed (14)
      Tests  69 passed (69)
Statements   : 100% ( 774/774 )
```

## 4. Commit / push

Fix is on `origin/main` at `b9f1e48` / `94cfb00`. This file is the evidence commit.

## 5. Vercel deploy

```
$ gh api repos/kirkstrobeck/gainmaps.com/deployments?per_page=4 --jq '.[] | "\(.created_at) id=\(.id) env=\(.environment) sha=\(.sha[0:7])"'
2026-08-26T19:04:01Z id=6110070434 env=Production sha=94cfb00
2026-08-26T19:02:11Z id=6110040698 env=Production sha=b9f1e48
2026-08-26T18:15:45Z id=6109270370 env=Production – gainmaps-com sha=d79710f
2026-08-26T18:14:35Z id=6109251496 env=Production – gainmaps-com-ultra-dark-mode sha=d79710f

$ gh api repos/kirkstrobeck/gainmaps.com/deployments/6110070434/statuses --jq '.[] | "\(.state) \(.target_url)"'
success https://gainmaps-cbfjqo4ur-kirk-strobeck.vercel.app
```

`npx vercel inspect` of that URL: status Ready, aliases include
`https://www.gainmaps.com` and `https://gainmaps-com.vercel.app`.
The prior `d79710f` `gainmaps-com` deploy (id 6109270370) is `failure`.

## 6. Live site

```
$ curl -s -o /dev/null -w '%{http_code}\n' https://www.gainmaps.com/developers
200

$ curl -s https://www.gainmaps.com/ | grep -o 'The original file, gain map encoded' | wc -l
2

$ curl -s https://www.gainmaps.com/ | grep -o 'The same file, two renderers' | wc -l
0
```

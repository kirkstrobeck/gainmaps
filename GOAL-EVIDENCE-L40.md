# GOAL-EVIDENCE-L40

Goal.md L40: `100% test coverage across whole repo`

This file records what was actually run. Later parts append below.

---

## Part 1 — `apps/web` coverage to 100%

### Same-shape audit

Searched production TypeScript for module-private lookup guards that throw on miss and are only called with known-good literals (the shape that leaves a `throw` unreachable from tests).

| Location | Shape | Action |
| --- | --- | --- |
| `apps/web/lib/logos/logo-strip.ts` `requireCompany` | private lookup-throw, only used with 3 catalog slugs | extracted to `apps/web/lib/logos/require-company.ts` and tested both branches |
| `apps/web/lib/photos/photo-intrinsic.ts` `photoIntrinsicSize` | same invariant | already exported; `photo-intrinsic.test.ts` already hits the throw |
| `apps/web/lib/svg-raster.ts` canvas `getContext` throw | environment guard, not a slug lookup | already at 100% in the before table (not listed as uncovered) |
| `src/png/filter.ts` `bestFilteredRow` | loop invariant with existing `v8 ignore next` | different shape; left as-is |
| `packages/gainmap/**` | no private `require*` lookup-throw | other agent owns this tree; not edited |

No other module in this repo had the private-guard-you-cannot-reach shape. Only `logo-strip.ts` was extracted.

Did **not**: add `istanbul`/`v8 ignore`, lower thresholds, widen `coverage.exclude`, delete a test, or delete the guard.

### Coverage table BEFORE (exit 1)

Command: `pnpm --filter web test` from `/workspace` on the tree before the extract.

```
 Test Files  87 passed (87)
      Tests  772 passed (772)
   Start at  19:46:53
   Duration  127.99s (transform 4.51s, setup 19.27s, import 5.65s, tests 21.81s, environment 58.32s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   99.92 |    99.86 |     100 |     100 |
 lib/logos         |      90 |       50 |     100 |     100 |
  logo-strip.ts    |      80 |       50 |     100 |     100 | 5
-------------------|---------|----------|---------|---------|-------------------

=============================== Coverage summary ===============================
Statements   : 99.92% ( 1425/1426 )
Branches     : 99.86% ( 754/755 )
Functions    : 100% ( 415/415 )
Lines        : 100% ( 1231/1231 )
================================================================================
ERROR: Coverage for statements (99.92%) does not meet global threshold (100%)
ERROR: Coverage for branches (99.86%) does not meet global threshold (100%)
/workspace/apps/web:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @gainmaps/web@1.0.0 test: `NODE_OPTIONS=--max-old-space-size=8192 vitest run --coverage`
Exit status 1
```

pnpm exit status: **1**

### `requireCompany` test passing lines

`vitest run test/lib/require-company.test.ts --reporter=verbose` (no coverage flag, so this filtered run is judged by the Tests line, not by global thresholds):

```
 ✓ test/lib/require-company.test.ts > requireCompany > returns the company for a known slug 2ms
 ✓ test/lib/require-company.test.ts > requireCompany > throws with a message naming an unknown slug 1ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
```

### Coverage table AFTER (exit 0)

Command: `pnpm --filter web test` from `/workspace` after extracting `requireCompany`.

```
 Test Files  88 passed (88)
      Tests  774 passed (774)
   Start at  19:50:09
   Duration  102.95s (transform 3.05s, setup 15.94s, import 4.22s, tests 14.21s, environment 49.26s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
-------------------|---------|----------|---------|---------|-------------------

=============================== Coverage summary ===============================
Statements   : 100% ( 1426/1426 )
Branches     : 100% ( 755/755 )
Functions    : 100% ( 415/415 )
Lines        : 100% ( 1231/1231 )
================================================================================
```

pnpm / vitest exit status: **0**

No `does not meet global threshold` ERROR lines.

Per-file table is empty because every included file is 100/100/100/100 — v8 only lists files with uncovered lines.

---

## Part 2 — workspace coverage audit

`pnpm-workspace.yaml` packages: `"."`, `"apps/*"`, `"packages/*"`.

Three workspace packages exist. None were missing 100% threshold enforcement. `packages/gainmap` was not edited (other agent).

### Per-workspace audit

| Package | Path | Test setup | `thresholds` 100/100/100/100 | Ran at 100% | Notes |
| --- | --- | --- | --- | --- | --- |
| `gainmaps.com` | `.` (root) | yes — `vitest.config.ts` + `"test": "vitest run --coverage"` | yes | **yes**, exit 0 | include `src/**/*.ts`; exclude `src/cli.ts`, `src/image/codec.ts` |
| `@gainmaps/web` | `apps/web` | yes — `apps/web/vitest.config.ts` + `"test": "… vitest run --coverage"` | yes | **yes**, exit 0 (Part 1) | include `app/**`, `components/**`, `lib/**`; exclude `app/layout.tsx` |
| `gainmap` | `packages/gainmap` | yes — `packages/gainmap/vitest.config.ts` + `"test": "tsc … && vitest run --coverage"` | yes | **yes**, exit 0 | include `src/**/*.ts`; exclude `src/**/*.d.ts`. **Reported only; not edited.** |

### Root `gainmaps.com` coverage (this run)

`pnpm test` after adding the workspace-threshold meta-test:

```
 Test Files  9 passed | 1 skipped (10)
      Tests  58 passed | 2 skipped (60)

=============================== Coverage summary ===============================
Statements   : 100% ( 751/751 )
Branches     : 100% ( 339/339 )
Functions    : 100% ( 124/124 )
Lines        : 100% ( 622/622 )
================================================================================
```

exit **0**

### `packages/gainmap` coverage (reported, not edited)

`pnpm --filter gainmap test`:

```
 Test Files  14 passed (14)
      Tests  69 passed (69)

=============================== Coverage summary ===============================
Statements   : 100% ( 774/774 )
Branches     : 100% ( 558/558 )
Functions    : 100% ( 131/131 )
Lines        : 100% ( 631/631 )
================================================================================
```

exit **0**

### `pnpm test` at root did not enforce L40

Root `"test"` is `vitest run --coverage` for **this package only** (`src/**/*.ts`). It cannot be changed to `turbo run test` — turbo would invoke the root `test` script again and recurse.

`pnpm check` already ran `turbo typecheck test`, which does walk every workspace `test` script. That coupling hides the coverage gate behind typecheck.

### Root-level task wired up

Added `"test:all": "turbo run test"`.

What it does: turbo 2 runs the `test` script in every workspace package in the graph (`gainmaps.com`, `@gainmaps/web`, `gainmap`). Each of those scripts already passes `--coverage` and already fails the process if any of statements/branches/functions/lines is under 100.

Added `test/workspace-coverage-thresholds.test.ts` so a workspace that drops the vitest 100% thresholds or the `--coverage` flag fails the root suite.

### `pnpm test:all` (this run)

```
> gainmaps.com@1.0.0 test:all /workspace
> turbo run test

   • Packages in scope: @gainmaps/web, gainmap, gainmaps.com
   • Running test in 3 packages

gainmaps.com:test:  ✓ test/workspace-coverage-thresholds.test.ts (1 test) 15ms
gainmaps.com:test:  Test Files  9 passed | 1 skipped (10)
gainmaps.com:test:       Tests  58 passed | 2 skipped (60)
gainmaps.com:test: All files          |     100 |      100 |     100 |     100 |

gainmap:test:  Test Files  14 passed (14)
gainmap:test:       Tests  69 passed (69)
gainmap:test: All files          |     100 |      100 |     100 |     100 |

@gainmaps/web:test:  Test Files  88 passed (88)
@gainmaps/web:test:       Tests  774 passed (774)
@gainmaps/web:test: All files          |     100 |      100 |     100 |     100 |

 Tasks:    3 successful, 3 total
Cached:    0 cached, 3 total
  Time:    1m55.311s
```

exit **0**

No workspace needed a vitest-config fix. `packages/gainmap` already enforced 100% and passed; left untouched.

---

## Part 3 — `llms.txt` false statements

Derived counts (not invented):

- slug directories on disk under `apps/web/public/photos/`: **38** (`find … -mindepth 1 -maxdepth 1 -type d | wc -l`)
- entries `/photos` renders from `PHOTOS` in `apps/web/lib/photos/catalog.ts`: **26** (`{ id:` matches and `catalog.test.ts` `has 26 entries`)

The gallery paginates `PHOTOS` (`photosForPage`); it does not walk the leftover directories. The true gallery size is 26.

### llms.txt before

```
- Homebrew: `brew install gainmaps`
- [Photo gallery](/photos) — 100 landscape photographs as gain map images
```

### llms.txt after

```
- Homebrew: `brew install kirkstrobeck/tap/gainmap`
- [Photo gallery](/photos) — 26 landscape photographs as gain map images
```

Canonical brew token derived from `Formula/gainmap.rb` (read-only): class `Gainmap` + GitHub owner `kirkstrobeck` → `kirkstrobeck/tap/gainmap`. Package name/version from `packages/gainmap/package.json` (read-only): `gainmap` / `1.0.1`.

Other stale "100 photographs" copy exists in `apps/web/app/photos/page.tsx` metadata ("One hundred Unsplash photographs") and a "48" in the catalog file comment. Not changed here — this part's defect is `llms.txt`. The new test will fail if `llms.txt` inflates the count again.

Did not modify `Formula/gainmap.rb`, `packages/gainmap/**`, or `install.sh`. Did not edit `apps/web/test/lib/version-drift.test.ts` (other agent's Formula+install.sh test). New file: `apps/web/test/lib/web-install-copy-drift.test.ts`.

### Drift test passing lines

`vitest run test/lib/web-install-copy-drift.test.ts --reporter=verbose`:

```
 ✓ test/lib/web-install-copy-drift.test.ts > web install copy drift > reads package name and version once from packages/gainmap/package.json 2ms
 ✓ test/lib/web-install-copy-drift.test.ts > web install copy drift > formula version field matches package.json version 0ms
 ✓ test/lib/web-install-copy-drift.test.ts > web install copy drift > llms.txt npm and brew commands match the canonical package and formula 0ms
 ✓ test/lib/web-install-copy-drift.test.ts > web install copy drift > developers page npm and brew commands match the canonical package and formula 0ms
 ✓ test/lib/web-install-copy-drift.test.ts > web install copy drift > llms.txt and the developers page agree with each other 0ms
 ✓ test/lib/web-install-copy-drift.test.ts > web install copy drift > llms.txt photo count matches the /photos catalog, not the on-disk leftover dirs 5ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

### Full web suite after Part 3 (exit 0)

```
 Test Files  89 passed (89)
      Tests  780 passed (780)

=============================== Coverage summary ===============================
Statements   : 100% ( 1426/1426 )
Branches     : 100% ( 755/755 )
Functions    : 100% ( 415/415 )
Lines        : 100% ( 1231/1231 )
================================================================================
```

exit **0**

---

## Part 4 — repo housekeeping

Checked `git ls-files` for each named path before touching anything.

### Already absent

| Path | Tracked? | Action |
| --- | --- | --- |
| `apps/web/.next-prod-OLD/` | no (not on disk) | none to delete; added gitignore so a future copy cannot return |
| `apps/web/.next-prod-OLD2/` | no (not on disk) | same |

`apps/web/.next-prod/` (126M, current isolated build) was **not** deleted — that is the live `build:isolated` output, already gitignored, not an OLD tree.

### Deleted

| Path | Tracked? | Why deleted |
| --- | --- | --- |
| `measure-fonts.cjs` | **yes** (`git ls-files`) | one-off Playwright font-byte probe; hardcoded `/workspace/node_modules/.pnpm/playwright@…` path; nothing in the repo imports it |
| `measure-fonts.mjs` | **yes** | same class, ES module rewrite |
| `measure-fonts2.cjs` | **yes** | same class, CDP priority probe |
| `reports/land/desktop.png` | **yes** (leaked through `reports/` gitignore) | landing-page screenshot from `verify-land.ts`; regenerable |
| `reports/land/mobile.png` | **yes** | same |
| `reports/land/*.png` (untracked rest) | no | same screenshot dump |
| `foo/` (`foo/assets/*.jpg` + `manifest.json`) | no (`foo/assets/` was already ignored) | Ultra HDR spike sandbox; gitignore comment already said regenerate locally |
| `.agent-answer.md` | no (already ignored) | previous agent transcript dump |
| `.lh-*.log` (analysis, desktop, items, numbered reruns) | no (`*.log` already ignored) | Lighthouse CLI stdout leftovers |
| `tmp-window-gain/` | no (already ignored) | window-gain calibration scratch (`cal7-iso.jpeg`, logs) |
| `test-results/` | no (already ignored) | Playwright smoke artifacts |

### Deliberately kept

| Path | Tracked? | Why kept |
| --- | --- | --- |
| `profiles/rec2020-pq.icc` | **yes** | real Rec.2020 PQ ICC profile; root tests open it as `PQ` |
| `profiles/rec2020.icc` | **yes** | real Rec.2020 ICC profile; root tests open it as `GAMUT` |
| `.reports/*.md` (+ screenshots) | no (already ignored) | authored bug / Lighthouse / design / gap reports from prior runs, not regenerable build output |
| `GOAL-EVIDENCE-L40.md` (this file) | yes after Part 1 | required evidence |
| `packages/gainmap/**` | — | other agent; not touched |
| `apps/web/public/photos/` | — | gallery assets; not touched |

### `.gitignore` classes added

- `apps/web/.next-prod-OLD/`, `apps/web/.next-prod-OLD2/`, `**/.next-prod-OLD*/`
- `measure-fonts*.cjs`, `measure-fonts*.mjs`
- `foo/` (was `foo/assets/` only)
- `.lh-*.log` (was two specific filenames; `*.log` already covered these)

Already present, left as-is: `.reports/`, `reports/`, `tmp-window-gain/`, `test-results/`, `.agent-answer.md`, `apps/web/.next-prod`.

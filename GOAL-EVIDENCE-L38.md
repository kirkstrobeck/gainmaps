# GOAL-EVIDENCE-L38

Evidence for GOAL.md L38 (install channels) and L28 (switch transition) work,
2026-08-26.

---

## PART 0 — Rescued uncommitted work

### Files judged complete and coherent

All 13 files were read and diffed. All were coherent and complete:

| File | Status |
|------|--------|
| `apps/web/app/error.tsx` | UltraWord added to h1 |
| `apps/web/app/not-found.tsx` | UltraWord added to h1 |
| `apps/web/components/site-footer.tsx` | FOOTER_LINKS imported from `@/lib/nav` |
| `apps/web/components/site-nav.tsx` | Community link added with ForumIcon |
| `apps/web/test/app/error.test.tsx` | UltraWord mock added |
| `apps/web/test/app/not-found.test.tsx` | UltraWord mock added |
| `apps/web/test/components/site-footer.test.tsx` | FOOTER_LINKS import updated |
| `apps/web/test/components/site-nav.test.tsx` | Community link assertion added |
| `apps/web/test/lib/routes.test.ts` | FOOTER_LINKS import updated |
| `apps/web/lib/nav.ts` | New file — PRIMARY_NAV_LINKS, FOOTER_LINKS, FOOTER_SECONDARY_LINKS |
| `apps/web/test/nav-model.test.ts` | New file — nav model tests |
| `apps/web/test/ultra-headings.test.ts` | New file — UltraWord in h1 tests |
| `tools/brew-verify-sha.sh` | New file — online sha256 verification script |

### Test run (partial vitest — coverage threshold trips on partial runs, judge by Tests line)

```
Test Files  85 passed (85)
     Tests  767 passed (767)
  Start at  19:32:07
  Duration  141.60s
```

### Commit

```
d4ea206 feat(nav,ultra): L6 ultra-heading sweep + L32 nav model
```

---

## PART 1a — GitHub release v1.0.1

### Releases before

```
gainmap v1.0.0	Latest	v1.0.0	2026-08-24T23:52:04Z
```

### Build and test

```
pnpm --filter gainmap build → tsc succeeded, dist/cli.js exists
pnpm --filter gainmap test:
  Test Files  14 passed (14)
       Tests  69 passed (69)
  Coverage: 100% statements, 100% branches, 100% functions, 100% lines
```

### Tarball contents (tar -tzf gainmap-1.0.1.tgz)

```
package/test/fixtures/input/frame.gif
package/test/fixtures/input/tree/a.jpg
package/test/fixtures/input/tree/nested/b.jpg
package/test/fixtures/expected/boost-1.jpg
package/test/fixtures/input/tree/skip/c.jpg
package/test/fixtures/expected/custom.jpg
package/test/fixtures/expected/gif-default.jpg
package/test/fixtures/expected/headroom-4.jpg
package/test/fixtures/expected/jpg-default.jpg
package/test/fixtures/expected/matte-checker.jpg
package/test/fixtures/expected/max-size-4.jpg
package/test/fixtures/expected/model-window.jpg
package/test/fixtures/input/photo.jpg
package/test/fixtures/expected/png-default.jpg
package/test/fixtures/expected/quality-80.jpg
package/test/fixtures/expected/suffix-hdr.jpg
package/test/fixtures/expected/svg-default.jpg
package/test/fixtures/expected/webp-default.jpg
package/dist/args.js
package/dist/cli.js
package/dist/convert.js
package/dist/decode.js
package/dist/encode.js
package/dist/extract-sdr-cmd.js
package/dist/extract-sdr.js
package/dist/output-path.js
package/dist/update.js
package/dist/version.js
package/dist/walk.js
package/package.json
... (51 files total — dist/ and bin confirmed)
```

### Smoke test (installed from packed tarball in temp prefix)

```
---version---
gainmap 1.0.1

---conversion---
/workspace/packages/gainmap/test/fixtures/input/photo.jpg -> /tmp/smoke-out.jpg

---verify output---
-rw-r--r-- 1 agent dialout 3806 Aug 26 19:37 /tmp/smoke-out.jpg
```

### Releases after

```
gainmap v1.0.1	Latest	v1.0.1	2026-08-26T19:37:17Z
gainmap v1.0.0		v1.0.0	2026-08-24T23:52:04Z
```

---

## PART 1b — Formula sha256 fixed

### shasum -a 256 gainmap-1.0.1.tgz

```
6a4c6275d6e2ff0738b4f3d9829e1ad91c7b86d4dd38826979cc741b0bf99b98  gainmap-1.0.1.tgz
```

### Formula/gainmap.rb line 6 (updated)

```ruby
sha256 "6a4c6275d6e2ff0738b4f3d9829e1ad91c7b86d4dd38826979cc741b0bf99b98"
```

(Previous value `d7c940658a21789601180b3949bc5c3e301d828940bd0503d22d2cf9b6d80156` was wrong — no artifact ever published with that hash.)

### sh tools/brew-verify-sha.sh

```
Formula version : 1.0.1
Formula sha256  : 6a4c6275d6e2ff0738b4f3d9829e1ad91c7b86d4dd38826979cc741b0bf99b98
Release URL     : https://github.com/kirkstrobeck/gainmaps.com/releases/download/v1.0.1/gainmap-1.0.1.tgz
Artifact sha256 : 6a4c6275d6e2ff0738b4f3d9829e1ad91c7b86d4dd38826979cc741b0bf99b98
OK — sha256 matches
```

---

## PART 1c — Version-drift test

New file: `apps/web/test/lib/version-drift.test.ts`

Reads `packages/gainmap/package.json` version (currently `1.0.1`) and asserts:
1. `Formula/gainmap.rb` url contains `v1.0.1/gainmap-1.0.1.tgz`
2. `Formula/gainmap.rb` version field is `"1.0.1"`
3. `packages/gainmap/install.sh` TARBALL default contains `gainmap-1.0.1.tgz`
4. `apps/web/app/install.sh/route.ts` contains `gainmap-1.0.1.tgz`

This test FAILS if any one source is bumped alone. It is pure filesystem reads — no network.
`tools/brew-verify-sha.sh` remains the network check (online sha verification).

### Test run (version-drift + switch, partial run)

```
Test Files  87 passed (87)
     Tests  772 passed (772)
  Start at  19:41:24
  Duration  174.71s
```

### Commit

```
fe7e39c fix(release): cut v1.0.1 release; fix formula sha256; add version-drift test
```

---

## PART 1d — npm channel BLOCKED

```
$ npm whoami
npm error code ENEEDAUTH
npm error need auth This command requires you to be logged in.
npm error need auth You need to authorize this machine using `npm adduser`
```

The container has no npm credentials. Publishing to npm is irreversible and has not been authorized.

**To publish when ready:**
```sh
cd packages/gainmap
npm login
npm publish --access public
```

**GOAL.md L38 status:** curl ✅ brew ✅ npm ❌ (unpublished — blocked on npm auth, human action required)

---

## PART 2 — Switch transition removed (L28)

### apps/web/components/ui/switch.tsx — before/after

Before (line 25):
```tsx
"pointer-events-none block size-6 rounded-full bg-[var(--panel)] shadow-md ring-1 ring-black/10 transition-transform",
```

After:
```tsx
"pointer-events-none block size-6 rounded-full bg-[var(--panel)] shadow-md ring-1 ring-black/10",
```

### Call sites affected

Both uses of `<Switch>` are in `apps/web/components/appearance-controls.tsx`:
- Line 220: `id="appearance-system"` — the "System preference" toggle
- Line 272: the Ultra display toggle

Both now snap instantly. Removing globally is consistent with the header toggle which was already instant.

### New test

`apps/web/test/components/switch.test.tsx` asserts the rendered thumb class does NOT contain `transition-transform`.

### Commit

```
e8bc8cf fix(switch): remove transition-transform from thumb for instant snap (L28)
```

---

## Summary of all commits (this session)

```
d4ea206 feat(nav,ultra): L6 ultra-heading sweep + L32 nav model          [Part 0]
fe7e39c fix(release): cut v1.0.1 release; fix formula sha256; add test   [Part 1b+1c]
e8bc8cf fix(switch): remove transition-transform from thumb for instant   [Part 2]
```

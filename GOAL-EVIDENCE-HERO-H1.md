# Hero `<h1>` UltraWord evidence

## Runtime diagnosis before the fix

The full raw capture is retained at `tmp/shots/h1-before-diagnostic.json`. Its production results were identical in the relevant respect at desktop/mobile and light/dark: `maskId` resolved, the backdrop had a non-zero box and a `url(#ultra-word-…)` mask, but the mask's `foreignObject` child was `0 × 0` in the XHTML namespace. Representative production JSON (desktop light):

```json
{
  "scenario": "production",
  "viewport": "desktop",
  "colorScheme": "light",
  "diagnostic": {
    "mode": "light",
    "ultra": "on",
    "h1": { "x": 996, "y": 134.59375, "width": 380, "height": 73.3125 },
    "backdrop": {
      "rect": { "x": 818.984375, "y": 97.9375, "width": 708.09375, "height": 146.625 },
      "backgroundColor": "rgb(23, 25, 28)", "opacity": "1",
      "maskImage": "url(\"#ultra-word-Rhsaudb\")",
      "webkitMaskImage": "url(\"#ultra-word-Rhsaudb\")", "display": "block"
    },
    "fill": { "rect": { "width": 0, "height": 0 }, "opacity": "0", "display": "none" },
    "maskId": "ultra-word-Rhsaudb", "idResolves": true,
    "foreignObject": {
      "rect": { "x": 0, "y": 0, "width": 0, "height": 0 },
      "innerRect": { "x": 0, "y": 0, "width": 0, "height": 0 },
      "innerNamespace": "http://www.w3.org/1999/xhtml"
    },
    "prefersLight": true
  }
}
```

The confirmed hypothesis is (b): Chromium did not paint XHTML `foreignObject` content in the SVG mask resource; the non-zero masked layers therefore received zero coverage. The resolved ID rules out the broken-reference hypothesis.

## Fix

`UltraWord` now keeps its selectable HTML text in `text-[var(--foreground)]`, so mask or HDR failures always degrade to readable text. The decorative layers remain above it and retain their HDR canvas. The mask now contains real SVG `<text>` nodes. A layout effect measures each whitespace-delimited range, groups them by visual line, and copies computed font family, size, style, weight, variation, feature, kerning, and spacing to each SVG line.

Relevant diff:

```diff
-      <span className={`${typeClassName} text-transparent`}>{text}</span>
+      <span ref={readableRef} className={`${typeClassName} text-[var(--foreground)]`}>{text}</span>
...
-            <foreignObject x="25%" y="25%" width="50%" height="50%">…</foreignObject>
+            {lines.map((line, index) => (
+              <text key={`${line.x}-${line.y}-${index}`} x={line.x} y={line.y}
+                dominantBaseline="central" fill="#ffffff" style={typography}>{line.text}</text>
+            ))}
```

This removes the only single point of failure: even an empty, unresolved, or unsupported mask cannot make the actual text transparent.

## After-fix diagnostics and visual inspection

The full local-and-production capture is `tmp/shots/h1-after-diagnostic.json`. The local result after the fix has `foreignObject: { rect: null, innerRect: null, innerNamespace: null }`, a resolved mask ID, and the same non-zero overlay geometry in all four combinations. Production remains the pre-deployment build during this run, so its raw result intentionally still records the old foreignObject.

Screenshots written and inspected:

- `tmp/shots/h1-after-local-desktop-light.png` — the dark “Gainmaps” heading is clearly visible on the light hero.
- `tmp/shots/h1-after-local-desktop-dark.png` — the bright Ultra “Gainmaps” heading is clearly visible.
- `tmp/shots/h1-after-local-mobile-light.png` — the dark heading remains legible at the 390 px layout.
- `tmp/shots/h1-after-local-mobile-dark.png` — the bright heading remains legible at the 390 px layout.

The required before captures are `h1-before-{production,local}-{desktop,mobile}-{light,dark}.png`. The matching after captures are `h1-after-{production,local}-{desktop,mobile}-{light,dark}.png`.

`tmp/shots/h1-wrap-diagnostic.json` confirms the mobile `/docs` heading produces four readable lines and four SVG mask lines (`What`, `Gainmaps`, `actually does`, `to an image`), with no foreignObject. `/developers` and the not-found route each produce one matching SVG mask line.

## Tests

```
✓ test/css-tokens.test.ts > CSS custom properties > defines every var token used by the web source
✓ test/components/ultra-word.test.tsx > UltraWord > keeps the selectable word readable as the fallback
✓ test/components/ultra-word.test.tsx > UltraWord > uses SVG text rather than foreignObject for the mask
✓ test/components/ultra-word.test.tsx > UltraWord > groups wrapped text fragments into one SVG mask line
Test Files  2 passed (2)
Tests  4 passed (4)
```

```
1 passed (10.7s)
[chromium] › smoke.spec.ts › home heading paints ink in both modes and with Ultra disabled
```

The Playwright smoke test captures the actual `<h1>` pixels with Sharp and requires more than 200 dark/light ink pixels in light, dark, and `data-ultra="off"` states; it also requires SVG mask text and a non-transparent selectable layer. The CSS-token test scans web source tokens against globals plus the three `next/font` declarations in layout.

## Full suite

The first `pnpm test:all` run began while concurrent agents were changing the shared tree and failed before this worktree's jsdom Range shim had been committed (`range.getBoundingClientRect is not a function` in `hero-section.test.tsx`). The targeted rerun after the shim passed:

```
Test Files  2 passed (2)
Tests  4 passed (4)
```

The clean retry ran every web test, including `hero-section`, `ultra-word`, `css-tokens`, and the new display tests, but exited 1 solely because simultaneously running agents removed Vitest's shared coverage temp directory at final report write:

```
Error: Something removed the coverage directory "/workspace/apps/web/coverage/.tmp" Vitest created earlier.
Caused by: ENOENT: no such file or directory, open '/workspace/apps/web/coverage/.tmp/coverage-77.json'
Tasks:    2 successful, 3 total
Failed:    @gainmaps/web#test
pnpm test:all exit code: 1
```

This is a genuine concurrent-process blocker, not a product or test failure; no threshold, exclusion, ignore, or test was changed to bypass it. A full rerun must begin only after all other `turbo run test` / Vitest processes have exited.

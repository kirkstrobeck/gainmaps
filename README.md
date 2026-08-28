# gainmaps.com

Give a JPEG or PNG the "impossibly saturated" look by **assigning** a Rec.2020 PQ
ICC profile — the same trick the Ashby logo on LinkedIn is (accidentally) doing.

The repo is one pnpm + Turborepo workspace: `gainmaps.com` at the root (the
`hdr-tag` CLI and the colour pipeline) and `@gainmaps/web` in `apps/web`.

## What it does — and does not do

It **assigns**, it never **converts**. The stored pixel values are left exactly
as they were; only the ICC profile telling viewers how to interpret those values
is swapped. A byte that said `154, 119, 255` in sRGB still says `154, 119, 255`
— but a Rec.2020 primaries + PQ transfer curve maps it to a far wider,
brighter colour, so HDR-capable displays render it near-fluorescent.

Implementation is container surgery, never a decode/re-encode:

- **JPEG** — split into marker segments plus the entropy-coded scan, replace the
  `APP2 / ICC_PROFILE` segments, write the scan back byte-for-byte.
- **PNG** — replace the `iCCP` chunk, leaving `IDAT` untouched. Conflicting
  `sRGB` / `gAMA` / `cHRM` chunks are dropped, since the PNG spec forbids `sRGB`
  alongside `iCCP`.

`assign` hashes the compressed pixel payload before and after and aborts if it
ever differs, so a quality regression can't pass silently.

`soften` is the exception: it intentionally rewrites PNG pixels to add a small
edge compensation before or after tagging. It keeps non-pixel chunks in place,
but `IDAT` changes by design.

## Prefer PNG

Tagging is lossless either way, but the tag can't add resolution or undo an
earlier encode. For flat vector-style art — logos, stickers, type, QR codes —
export **PNG at the largest size you'll ever need**, then tag that. PNG has no
quantization and no chroma subsampling, so edges stay crisp and alpha survives.

`inspect` reports the numbers that decide this: pixel dimensions, chroma
sampling, and the average luma quantization value (≈1 means near-lossless).

## PQ destroys anti-aliasing — use `edges` first

The saturation pop comes from the **primaries**. The jagged edges come from the
**transfer curve**. They are separable, and that is the whole fix.

Anti-aliasing is authored against a roughly perceptual curve: the blended pixel
on a letter's edge is meant to read as a midpoint. PQ's shadow slope is far
steeper, so that midpoint collapses onto the dark side. A white-on-blue edge:

| pixel | RGB | as sRGB | as PQ |
| --- | --- | --- | --- |
| letter | `255,253,242` | 98.1 nits | 9284 nits (92.8% of white) |
| blend | `78,93,166` | 11.7 nits | 41.0 nits (**0.41%** of white) |
| background | `53,70,155` | 7.0 nits | 21.2 nits (0.21%) |

White-to-blend contrast goes from **8.4:1 to 226:1** — a 27x expansion. The one
pixel meant to bridge the edge joins the background instead, so the soft edge
becomes a one-pixel cliff with a dark rim. That's the "bad photo effect" look.

`edges` measures this across the whole image before you commit to a profile:

```
$ npm run cli -- edges "Sticker.png" --preset pq
  anti-alias  15895 blended pixels
  authored    sits 35.7% between its neighbours
  assigned    sits 15.4% between its neighbours
  collapsed   72.8% of them lose half their blend or more
  verdict     anti-aliasing collapses 2.3x toward the dark side — ...
  distance    dE 72.8 authored (sRGB primaries)
              dE 77.5 with Rec.2020 primaries
  spread      1.07x further overall, 1.11x in chroma alone
  soften      one blended pixel per edge now has more ground to cover; try `soften --amount 0.11`

$ npm run cli -- edges "Sticker.png" --preset gamut
  collapsed   0.0% of them lose half their blend or more
  verdict     curve is safe — anti-aliasing survives it
```

## Presets

| preset | profile | look | edges |
| --- | --- | --- | --- |
| `pq` (default) | Rec.2020 + PQ | the Ashby effect | destroyed on anti-aliased art |
| `gamut` | Rec.2020 + BT.2020 transfer | same wide gamut | intact |

Both profiles carry **the same Rec.2020 primaries** — verified by comparing their
`rXYZ`/`gXYZ`/`bXYZ`/`wtpt` tags, which agree to the fifth decimal — so the gamut
is identical and the saturation is identical. Only the tone curve differs, and
BT.2020's curve tracks sRGB closely. For photographs, `pq` is fine. For logos,
type, stickers, or any anti-aliased vector art, use `gamut`.

## Usage

```sh
npm install

# retag with the bundled Rec.2020 PQ profile -> Sticker-pq.png
npm run cli -- assign "Sticker.png"

npm run cli -- assign in.png --preset gamut      # -> in-rec2020.png
npm run cli -- edges in.png --preset pq          # will PQ wreck this art?
npm run cli -- soften in.png --amount 0.11       # -> in-softened.png

npm run cli -- assign in.png -o out.png          # explicit output
npm run cli -- assign in.jpg --profile my.icc    # a different profile
npm run cli -- assign in.jpg --from donor.jpg    # copy another image's profile

npm run cli -- inspect out.png                   # size, quality, profile
npm run cli -- extract donor.jpg -o profile.icc  # pull a profile out
```

`--profile`, `--from` and `--preset` are mutually exclusive. Verify on macOS with
`sips -g profile -g pixelWidth out.png`.

`soften` currently supports PNG only. If `--amount` is omitted, it uses the
chroma-stretch recommendation from `edges`; `0` leaves pixels unchanged and `1`
applies the full compensation.

## The profiles

macOS ships no Rec.2020 PQ profile. `profiles/rec2020-pq.icc` was extracted from
the Ashby logo with this tool's own `extract` command:

```sh
npm run cli -- extract ashbyhq_logo.jpg -o profiles/rec2020-pq.icc
```

`Rec2020 Gamut with PQ Transfer`, ICC v4.4.0, 9176 bytes, `mntr` / `RGB -> XYZ`.

`profiles/rec2020.icc` is macOS's own `ITU-2020.icc` — `Rec. ITU-R BT.2020-1`,
ICC v4.0.0, 556 bytes, parametric TRC.

## Layout

| file | role |
| --- | --- |
| `src/image/codec.ts` | the format-agnostic contract |
| `src/image/registry.ts` | pick a codec from the file's magic bytes |
| `src/image/jpeg-codec.ts` · `png-codec.ts` | per-format implementations |
| `src/jpeg/markers.ts` | marker constants and classification |
| `src/jpeg/structure.ts` | parse/serialize segments, keep the scan opaque |
| `src/jpeg/icc-segments.ts` | read and rewrite `APP2 / ICC_PROFILE` chunks |
| `src/jpeg/dimensions.ts` | frame size, chroma sampling, quantization average |
| `src/png/crc32.ts` · `chunks.ts` | PNG chunk reader/writer with checksums |
| `src/png/icc-chunk.ts` | deflate/inflate the `iCCP` chunk |
| `src/png/decode.ts` | inflate `IDAT` and undo scanline filters, for analysis |
| `src/png/filter.ts` · `encode.ts` | PNG scanline filtering and `IDAT` replacement for `soften` |
| `src/icc/tags.ts` | ICC tag table lookup |
| `src/icc/describe.ts` | ICC header + `desc`/`mluc` reader, for reporting |
| `src/icc/primaries.ts` | `XYZ ` colorant tags — proves two profiles share a gamut |
| `src/color/transfer.ts` | sRGB, BT.2020 and PQ transfer functions and inverses |
| `src/color/edge-report.ts` | how much anti-aliasing a curve destroys |
| `src/color/gamut-distance.ts` | how much Rec.2020 primaries stretch edge colour distance |
| `src/color/soften.ts` | edge-aware pixel compensation in assigned-profile light |
| `src/profile/presets.ts` | the bundled `pq` / `gamut` profiles |
| `src/profile/resolve.ts` | pick the profile: flag, donor image, or preset |
| `src/commands/*.ts` | `assign`, `inspect`, `extract`, `edges`, `soften` |
| `src/cli.ts` | argument dispatch |

Everything is TypeScript, run through `tsx`. No Python, no shell helpers.

## Tests

```sh
pnpm test
pnpm typecheck
```

`test/window-gain.test.ts` compares a local Ultra HDR encode against an Apple
HEIC reference when `fixtures/window/` is present on disk. Those files are not
in git.

## Caveats

- The effect is display-dependent. It reads as a vivid pop on wide-gamut/HDR
  screens and colour-managed browsers, and can look muted or plain wrong
  elsewhere.
- Anything that re-encodes the image (most CMS pipelines, social uploads) may
  drop or convert the profile and undo the effect.
- PQ is an *absolute* luminance encoding: code 1.0 means 10,000 nits. Nothing in
  the file is wrong when edges break under it — the artwork was simply authored
  against a different curve. Re-render the art with PQ-aware anti-aliasing, or
  use `--preset gamut`.

## License

Original source code (TypeScript under `src/`, `test/`, `apps/`, `tools/`) is
released under the MIT License — see [LICENSE](LICENSE).

Third-party assets are **not** covered by that grant:

- **Brand logos** under `apps/web/public/logos/` are trademarks of their
  respective owners, included solely to demonstrate the gain-map / Ultra HDR
  effect. They are not MIT-licensed.
- **Photographs** under `apps/web/public/photos/` and any Unsplash hotlinks in
  `apps/web/lib/photos/catalog.ts` remain under the
  [Unsplash License](https://unsplash.com/license) with photographer credit as
  recorded in the catalog. They are not MIT-licensed.
- **ICC profiles** bundled at `profiles/` (`rec2020-pq.icc`, `rec2020.icc`),
  with copies served by the web app from `apps/web/public/profiles/`, have their
  own origin as described in The profiles section above. They are not original
  works authored here and are not MIT-licensed.
- **Fixture images** under `fixtures/` are test fixtures. Their inclusion does
  not grant rights in the depicted artwork beyond running the test suite.

## CLI (`gainmap`)

Convert images to Ultra HDR JPEG gain maps:

```sh
brew install kirkstrobeck/tap/gainmap
gainmap photo.jpg
gainmap -R ./shots -o ./out
```

> **Note:** `brew install gainmap` (without the tap prefix) requires a homebrew-core PR submission, which is planned for a future release.

Source: [github.com/kirkstrobeck/gainmaps.com](https://github.com/kirkstrobeck/gainmaps.com). From this clone: `brew install --HEAD --formula ./Formula/gainmap.rb`. Without Homebrew: `pnpm install && pnpm --filter gainmap build`. Full flags, Docker, and requirements: [docs/cli.md](docs/cli.md).

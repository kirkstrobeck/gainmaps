# Changelog

## 1.1.0 — 2026-08-27

- **Breaking:** default sibling suffix is `-gain` (`photo.jpg` → `photo-gain.jpg`); it was `-gainmap`
- `-o` is optional; recursive and multi-file `-o` must be a directory and mirrors the source tree without appending `-gain` unless `--suffix` is passed
- `--out` is an alias of `--output` (alongside `-o`)
- `--out-type` sets the output format when `--out`/`-o`/`--output` is a directory (`jpg`/`jpeg`/`png`/`webp`/`avif`/`tif`/`tiff`/`gif`)
- File `--out` chooses type from the extension; `--out-type` is optional and must agree when both are set
- `jpg`/`jpeg` still write Ultra HDR gain maps; other types encode the decoded RGBA raster with sharp
- PNG and WebP outputs keep alpha
- `--in-place` / `-i` overwrites the original JPEG (implies force; JPEG only)
- Unknown flags exit 2 with `unsupported option`
- `--out-type heic` / `--out dest.heic` error: this encoder writes Ultra HDR JPEG, HEIC is input only
- curl installer bundles Node 24 into `$HOME/.gainmap/runtime`; no system Node required

## 1.0.1 — 2026-08-25

- Homebrew/npm bin never started the CLI: `shouldRunMain` compared `import.meta.url` to the symlink at `argv[1]`, so `gainmap` was a no-op
- Print `input -> output` on stderr for a single-file convert (not only batch or `--verbose`)
- PNG, HEIC, and other non-JPEG inputs default to `*-gainmap.jpg`
- Explicit `-o` to a non-JPEG file is rejected; Ultra HDR requires `.jpg` / `.jpeg`

## 1.0.0 — 2026-08-24

First public release.

- Convert images to Ultra HDR JPEG (ISO/TS 21496-1 gain maps)
- Batch convert files and directories with `--recursive`
- stdin/stdout support for pipeline use
- Docker support
- Self-update via `gainmap update`
- Update notifications on stderr (configurable, opt-out with `--no-update-check`)

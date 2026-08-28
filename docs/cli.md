# gainmap CLI

Convert photos, logos, and other images into Ultra HDR JPEG files with an embedded gain map (ISO/TS 21496-1 / Android Ultra HDR / Apple Adaptive HDR). This is the same keep-base encoder as [gainmaps.com](https://gainmaps.com) convert.

A gain-map JPEG is still a normal JPEG: every app can open the SDR base. HDR displays expand highlights using the second layer.

## Install

### Homebrew

```sh
brew install kirkstrobeck/tap/gainmap
```

Or install `--HEAD` from this repo:

```sh
brew install --HEAD --formula ./Formula/gainmap.rb
```

> **Note:** `brew install gainmap` (without the tap prefix) requires a homebrew-core submission, which is planned for a future release.

Homebrew installs Node for you. The formula does not need libvips, ImageMagick, or Python.

### Without Homebrew

Node.js 24+ and npm or pnpm. From this repository:

```sh
pnpm install
pnpm --filter gainmap build
pnpm --filter gainmap exec node dist/cli.js --help
```

Or a global binary without Homebrew:

```sh
cd packages/gainmap
npm install
npm run build
npm link
gainmap --help
```

`npx` from that directory after build: `node dist/cli.js photo.jpg`.

### npm (curl)

```sh
curl -fsSL https://gainmaps.com/install.sh | sh
```

Installs to `/usr/local/bin/gainmap` by default. Override with `GAINMAP_INSTALL_DIR=~/bin`. The curl installer bundles Node 24 into `$HOME/.gainmap/runtime`; no Node install is needed. Homebrew installs Node for you. `npm install -g` is enough.

### Docker

Debian (glibc), not Alpine. The Dockerfile is multi-stage: it compiles inside the image. Sharp ships a prebuilt libvips — no extra apt packages.

```sh
docker build -t gainmap packages/gainmap
docker run --rm -v "$PWD:/work" gainmap photo.jpg
docker run --rm -v "$PWD:/work" gainmap -R ./shots -o ./out
```

### e2e install tests (Dockerfile.e2e)

Tests all three install paths (npm, curl, brew-equivalent) in Docker stages:

```sh
# from repo root
docker build -f packages/gainmap/Dockerfile.e2e .
```

The final `test-all` stage (from scratch) copies sentinel files from each install stage — it fails if any stage fails. Individual stages:

| Stage | Method |
| --- | --- |
| `test-npm` | `npm install -g gainmap-*.tgz` |
| `test-curl` | `sh install.sh` with local tarball + guards (no-node, unwritable-dir) |
| `test-brew` | HEAD-style wrapper + `ruby -c Formula/gainmap.rb` |

Each stage runs `e2e/run.sh` which covers --help, --version, all 16 scenarios, and `sha256sum -c checksums.sha256`.

## Requirements

**Runtime**

- Node.js 24+ for npm and source installs (`hdrify` declares `>=24`). Homebrew installs Node for you. The curl installer bundles Node 24 into `$HOME/.gainmap/runtime`. The Docker image includes Node.
- Sharp's platform binary, downloaded at `npm install` (needs network at **install** time, not when converting)
- `heic-decode` is bundled (HEIC does **not** need system libheif)

**Not required**

- libvips, ImageMagick, Python, macOS `sips`, a GPU, or a browser

**Limits / extras**

- Install-time network for npm + sharp prebuilds. Offline convert works after install.
- Alpine/musl is unsupported by the Dockerfile. Use `node:24-bookworm-slim` (or another glibc image).
- Animated GIF: first frame only.
- Very large images are memory-bound (the whole raster is decoded).
- SVG rasterization is Sharp/librsvg's subset of SVG. HEIC is input only. Unknown flags exit 2 as unsupported option.

## Usage

```
gainmap [options] <input...>
gainmap convert [options] <input...>
```

Input is a file, a directory, or `-` for stdin. Directories convert matching images in that folder. Use `-R`/`--recursive` for nested trees. Without `-R`, a directory is **flat-only**.

Default output: `photo.jpg` → `photo-gain.jpg` next to the input. Non-JPEG inputs (PNG, HEIC, WebP, …) become `*-gain.jpg`. Existing files are skipped unless `-f`/`--force`. Originals are left alone unless `--in-place`.

### Output

| Flag | Meaning |
| --- | --- |
| `-o, --out, --output <path>` | File (single input), directory (required for recursive/multi-file; recursive `-o` mirrors source dirs), or `-` for stdout |
| `--out-type <type>` | Output format when `--out` is a directory: `jpg` `jpeg` `png` `webp` `avif` `tif` `tiff` `gif` (leading dot and case ignored). File `--out` uses the extension; `--out-type` must agree if both are set. `jpg`/`jpeg` write Ultra HDR gain maps; other types encode via sharp. PNG/WebP keep alpha. |
| `--suffix <str>` | Default `-gain` |
| `-i, --in-place` | Overwrite the original JPEG (implies force) |
| `-f, --force` | Overwrite existing outputs (e.g. `photo-gain.jpg`) |
| `--no-clobber` | Skip existing (default) |
| `-n, --dry-run` | Print planned paths, write nothing |
| `--stdout` | Write one conversion to stdout (logs on stderr) |
| `--stdin` | Read image bytes from stdin |

### Conversion

| Flag | Meaning |
| --- | --- |
| `-q, --quality <1-100>` | Encode quality for JPEG, WebP, and AVIF (default 92). Not quiet. |
| `--boost <0-1>` | HDR boost (default 0.5) |
| `--headroom <n>` | Explicit headroom; overrides `--boost` |
| `--model <name>` | `highlight` (default) or `window` |
| `--matte <name>` | `white` (default) or `checkerboard` |
| `--max-size <px>` | Fit longest edge before encode |

### Walk

| Flag | Meaning |
| --- | --- |
| `-R, -r, --recursive` | Recurse into directories |
| `--ext <list>` | Comma-separated extensions (default: jpg,jpeg,png,webp,avif,gif,tif,tiff,svg,heic,heif) |
| `--exclude <glob>` | Skip matching paths (repeatable) |

### Runtime

| Flag | Meaning |
| --- | --- |
| `-j, --jobs <n>` | Parallel conversions (default CPU count, max 8) |
| `-v, --verbose` | Log every file to stderr |
| `--quiet` | Errors only |
| `--continue` | Keep going after a failed file (exit 1 if any failed) |
| `-h, --help` | Help |
| `-V, --version` | Print `gainmap 1.1.0` |
| `--update`, `--self-update` | Upgrade this CLI (or `gainmap update`) |
| `--auto-update` | If a newer release exists, upgrade then ask you to re-run |
| `--no-update-check` | Skip the update check |
| `--offline` | Same as `--no-update-check` |

## Examples

```sh
gainmap photo.jpg
gainmap photo.jpg -o hdr.jpg
gainmap photo.png
gainmap photo.png --out dest.webp
gainmap photo.png --out ./out --out-type webp
gainmap -R ./shots --out ./out --out-type png
gainmap -i photo.jpg
gainmap ./shots
gainmap -R ./shots -o ./out
gainmap -R -i ./shots
gainmap -R --exclude '**/raw/**' ./shots
gainmap --boost 1 --matte checkerboard logo.jpg
gainmap -n -R ./shots
```

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Conversion error (or any failure with `--continue`) |
| 2 | Usage error, missing path, unsupported type, or empty directory |

## Website converter

The CLI uses the same keep-base Ultra HDR path as the in-browser converter: default boost 0.5, highlight model, white matte, JPEG quality 92. The browser converter names files `*-gainmap.jpg`; the CLI default is `*-gain.jpg`.

## Version and updates

Check your installed version:

```sh
gainmap -V
```

gainmap checks for updates on each run (help, version, and convert) and prints a notice to stderr if a newer release exists. The check is cached for 24 hours under `~/.cache/gainmap` (`GAINMAP_CACHE_DIR` / `XDG_CACHE_HOME` override). A failed or 404 registry lookup is silent and never fails a conversion. Convert still works offline; only the optional notice needs network.

**Update gainmap:**

```sh
gainmap update         # or: gainmap --update / gainmap --self-update
```

Detects your install method (Homebrew, npm, curl, Docker) and upgrades accordingly.

**Disable update checks:**

```sh
gainmap --no-update-check photo.jpg
# or set once in your shell:
export GAINMAP_NO_UPDATE_CHECK=1
```

`--offline` / `GAINMAP_OFFLINE=1` also disables the check.

**Auto-update on each run:**

```sh
GAINMAP_AUTO_UPDATE=1 gainmap photo.jpg
# or:
gainmap --auto-update photo.jpg
```

## Contributing

Contributions are welcome. Repository: https://github.com/kirkstrobeck/gainmaps.com

```sh
git clone https://github.com/kirkstrobeck/gainmaps.com.git
cd gainmaps.com && pnpm install
pnpm --filter gainmap test
```

See [CONTRIBUTING.md](../packages/gainmap/CONTRIBUTING.md) for style notes.

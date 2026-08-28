# Gainmaps

Gainmaps converts ordinary images into Ultra HDR gain map JPEGs. The production web app is https://www.gainmaps.com/ and the Product Hunt page is https://www.producthunt.com/products/gain-maps-stunning-colors-for-ui.

A gain map JPEG carries an SDR base image plus a brightness map for HDR displays. Apps and displays that do not support HDR gain maps keep showing the SDR image; capable displays expand highlights above SDR reference white.

## What is in this repo

- apps/web: Next.js app for the browser converter, galleries, documentation, Product Hunt launch links, and Ultra text demos.
- packages/gainmap: gainmap CLI and TypeScript library for local, batch, and CI conversion.
- skills/ultra-text: reusable agent skill for the accessible canvas-mask Ultra text implementation used on the site.
- tools/logos and tools/photos: asset pipelines for local logo variants and Supabase-backed photo metadata.

The repository history was intentionally squashed for public release. Current main is the public source of truth.

## Local development

Install dependencies with pnpm install. Run the web app with pnpm dev, or build the production app with pnpm --filter @gainmaps/web build.

Useful checks:

- pnpm typecheck
- pnpm --filter gainmap test
- pnpm --filter @gainmaps/web exec vitest run --coverage.enabled=false
- pnpm --filter @gainmaps/web build

## CLI

Install the CLI with npm install -g gainmap, brew install kirkstrobeck/tap/gainmap, or curl -fsSL https://gainmaps.com/install.sh | sh. By default, conversion writes a sibling file ending in -gain, for example photo.jpg to photo-gain.jpg.

Examples:

- gainmap photo.jpg
- gainmap -R ./photos --out ./out
- gainmap logo.png --boost 1 --matte checkerboard

## Ultra text

Ultra text is still implemented as an accessible mask: real text remains in the DOM and the HDR treatment is painted through a canvas-backed mask. The latest implementation also relies on extra edge handling so the result does not look crispy: a reduced inner inset, a very small inner white blur, and a foundation layer derived as a percentage of the specified headroom.

Recommended path: install the skill so projects can receive future Ultra text refinements over time.

- npx skills add kirkstrobeck/gainmaps

## Assets

High-resolution photo source files are not stored in the repository. Photo catalog assets are hosted in Supabase static storage. The logo showcase keeps generated local SDR and Ultra HDR JPEG variants under apps/web/public/logos.

## Links

- Website: https://www.gainmaps.com/
- Product Hunt: https://www.producthunt.com/products/gain-maps-stunning-colors-for-ui
- Ultra text skill: https://github.com/kirkstrobeck/gainmaps/tree/main/skills/ultra-text

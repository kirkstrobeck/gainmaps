# gainmap

CLI to convert images into Ultra HDR JPEG gain maps (ISO/TS 21496-1), and SDR MP4 videos into Ultra MP4. Same keep-base image encoder as [gainmaps.com](https://gainmaps.com).

```sh
gainmap photo.jpg
gainmap ./shots
gainmap -R ./shots -o ./out
gainmap photo.png --out ./out --out-type webp
gainmap clip.mp4 --out clip-ultra.mp4
gainmap -i photo.jpg
```

Install, every flag, Docker, and requirements: **[docs/cli.md](../../docs/cli.md)**.

Quick paths:

- Homebrew tap: `brew install kirkstrobeck/tap/gainmap`
- From this clone: `brew install --HEAD --formula ./Formula/gainmap.rb`
- Without brew: `cd packages/gainmap && npm install && npm run build && npm link`
- Docker: `docker build -t gainmap packages/gainmap && docker run --rm -v "$PWD:/work" gainmap photo.jpg`
- MP4: requires `ffmpeg`; macOS uses Apple `hevc_videotoolbox` for QuickTime when available, otherwise `libx265` and converts SDR video to Ultra MP4 with QuickTime-friendly HLG on macOS or HDR10/PQ elsewhere; this is video HDR, not a JPEG gain-map container
- e2e install tests: `docker build -f packages/gainmap/Dockerfile.e2e .` (from repo root; tests npm, curl, and brew-equivalent paths)

## Contributing

Contributions are welcome. Open an issue or pull request at [github.com/kirkstrobeck/gainmaps](https://github.com/kirkstrobeck/gainmaps). See [CONTRIBUTING.md](./CONTRIBUTING.md).

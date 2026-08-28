"use client";

import { LayersIcon as LibraryIcon } from "@/components/icons";
import { CopyButton } from "@/components/copy-button";

const SECTION_ICON_CLS =
  "flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)-2px)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel))] text-[var(--accent)]";

const CODE_CLS =
  "rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono text-[var(--foreground)]";

const INSTALL_CMD = "npm install gainmap";

const SIGNATURE = `function encodeRgbaToUltraHdrJpeg(
  pixels:  Uint8Array,         // RGBA, 8 bits per channel
  width:   number,
  height:  number,
  options: GainMapEncodeOptions = {}
): GainMapEncodeResult`;

const TS_EXAMPLE = `import { encodeRgbaToUltraHdrJpeg } from "gainmap/encode";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const input = await readFile("photo.png");
const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const result = encodeRgbaToUltraHdrJpeg(
  new Uint8Array(data),
  info.width,
  info.height,
  { boost: 0.7, quality: 90 },
);

await writeFile("photo-gainmap.jpg", result.output);
console.log(result.note); // "Gain map JPEG · 3.94× · 3024×4032"`;

export function DevelopersAPISection() {
  return (
    <section id="library" className="scroll-mt-24 py-10">
      <div className="flex items-center gap-3">
        <span className={SECTION_ICON_CLS} aria-hidden>
          <LibraryIcon size={16} />
        </span>
        <h2 className="font-display text-2xl font-bold tracking-normal">Library</h2>
      </div>
      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
        The <code className={CODE_CLS}>gainmap</code> package exports a programmatic encode API
        from the <code className={CODE_CLS}>gainmap/encode</code> entrypoint. It runs in Node.js
        18+ and is suitable for server-side or build-time encoding.
      </p>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
        For the gain map format itself — what the output file contains and how displays render
        it — see the{" "}
        <a href="/docs" className="text-[var(--accent)] underline underline-offset-2 transition hover:opacity-75">
          format docs →
        </a>
      </p>

      <h3 className="mt-8 font-display text-lg font-semibold tracking-normal">Installation</h3>
      <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 flex items-center justify-between gap-2">
        <code className="font-mono text-sm text-[var(--foreground)]">{INSTALL_CMD}</code>
        <CopyButton text={INSTALL_CMD} />
      </div>

      <h3 className="mt-8 font-display text-lg font-semibold tracking-normal">
        encodeRgbaToUltraHdrJpeg
      </h3>
      <div className="mt-3 text-sm leading-7 text-[var(--muted)]">
        <p>
          The primary encode function. Accepts raw RGBA pixel data and returns an Ultra HDR JPEG
          as a <code className={CODE_CLS}>Uint8Array</code>.
        </p>
        <div className="mt-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 flex items-start justify-between gap-2">
          <code className="block font-mono text-sm text-[var(--foreground)] whitespace-pre">{SIGNATURE}</code>
          <CopyButton text={SIGNATURE} />
        </div>
      </div>

      <h3 className="mt-8 font-display text-lg font-semibold tracking-normal">GainMapEncodeOptions</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-2 pr-4 font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Option</th>
              <th className="pb-2 pr-4 font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Type</th>
              <th className="pb-2 font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Description</th>
            </tr>
          </thead>
          <tbody className="text-[var(--muted)]">
            {[
              ["boost", "number (0–1)", "UI boost level. 0.5 = default photo headroom (~3.34×)."],
              ["headroom", "number", "Explicit headroom multiplier; overrides boost when set."],
              ["quality", "number (1–100)", "JPEG quality of the SDR base. Default 92."],
              ["hdrModel", '"highlight" | "window"', "Highlight-selective (default) or window-calibrated HDR model."],
              ["matte", '"white" | "checkerboard"', "Background matte for transparent pixels. Default white."],
            ].map(([opt, type, desc]) => (
              <tr key={opt} className="border-b border-[var(--border)] last:border-b-0">
                <td className="py-2.5 pr-4 font-mono font-medium text-[var(--foreground)]">{opt}</td>
                <td className="py-2.5 pr-4 font-mono text-[var(--foreground)]">{type}</td>
                <td className="py-2.5 leading-6">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 font-display text-lg font-semibold tracking-normal">TypeScript example</h3>
      <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] px-4 py-4 flex items-start justify-between gap-2">
        <code className="block font-mono text-sm text-[var(--foreground)] whitespace-pre">{TS_EXAMPLE}</code>
        <CopyButton text={TS_EXAMPLE} />
      </div>
    </section>
  );
}

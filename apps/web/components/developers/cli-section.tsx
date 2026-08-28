"use client";

import { TerminalIcon } from "@/components/icons";
import { CopyButton } from "@/components/copy-button";
import gainmapPkg from "../../../../packages/gainmap/package.json";

const SECTION_ICON_CLS =
  "flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)-2px)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel))] text-[var(--accent)]";

const CODE_CLS =
  "rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono text-[var(--foreground)]";

export function DevelopersCLISection() {
  return (
    <section id="cli" className="scroll-mt-24 border-b border-[var(--border)] py-10">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={SECTION_ICON_CLS} aria-hidden>
          <TerminalIcon size={16} />
        </span>
        <h2 className="font-display text-2xl font-bold tracking-normal">CLI</h2>
        <span className="text-sm text-[var(--muted)]">
          v{gainmapPkg.version}{" "}·{" "}
          <a href="https://github.com/kirkstrobeck/gainmaps.com/blob/main/packages/gainmap/CHANGELOG.md" className="text-[var(--accent)] underline underline-offset-2 transition hover:opacity-75">
            Changelog
          </a>
        </span>
      </div>
      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
        The <code className={CODE_CLS}>gainmap</code> CLI converts images to Ultra HDR JPEG gain
        maps (ISO 21496-1). JPEG, PNG, WebP, and other inputs write a sibling JPEG by default
        (<code className={CODE_CLS}>photo.png</code> →{" "}
        <code className={CODE_CLS}>photo-gain.jpg</code>). Pass{" "}
        <code className={CODE_CLS}>-o filename.jpg</code> to choose a path, or{" "}
        <code className={CODE_CLS}>-i</code> to overwrite a JPEG original.
      </p>

      <div
        className="mt-6 rounded-[var(--radius)] border px-4 py-3 text-sm leading-7"
        style={{
          borderColor: "color-mix(in srgb, var(--accent) 22%, var(--border))",
          background: "color-mix(in srgb, var(--accent) 6%, var(--panel))",
        }}
      >
        <p className="font-medium text-[var(--foreground)]">Your original file is never modified unless you pass <code className="rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono">--in-place</code>.</p>
        <p className="mt-1 text-[var(--muted)]">
          Output writes to a sibling:{" "}
          <code className="rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono">photo.jpg</code>{" "}
          →{" "}
          <code className="rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono">photo-gain.jpg</code>.
          An existing output is skipped by default (<code className="rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono">--no-clobber</code>).
          Use{" "}
          <code className="rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono">--force</code>{" "}
          (<code className="rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono">-f</code>) to overwrite.
        </p>
      </div>

      <h3 className="mt-8 font-display text-lg font-semibold tracking-normal">Installation</h3>
      <div className="mt-3 grid gap-3">
        {[
          { label: "npm", cmd: "npm install -g gainmap" },
          { label: "Homebrew", cmd: "brew install kirkstrobeck/tap/gainmap" },
          { label: "curl", cmd: "curl -fsSL https://gainmaps.com/install.sh | sh" },
        ].map(({ label, cmd }) => (
          <div
            key={label}
            className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] px-4 py-2.5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-16 shrink-0 text-xs font-medium text-[var(--muted)]">{label}</span>
              <code className="flex-1 truncate font-mono text-sm text-[var(--foreground)]">{cmd}</code>
            </div>
            <CopyButton text={cmd} />
          </div>
        ))}
      </div>

      <h3 className="mt-8 font-display text-lg font-semibold tracking-normal">Flags</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[540px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-2 pr-4 font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Flag</th>
              <th className="pb-2 font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Description</th>
            </tr>
          </thead>
          <tbody className="text-[var(--muted)]">
            {[
              ["-o, --out, --output <path>", "File (single input), directory (required for recursive/multi-file; mirrors source dirs), or - for stdout"],
              ["--out-type <type>", "Output format when --out is a directory (jpg jpeg png webp avif tif tiff gif). File --out uses the extension; --out-type must agree if both are set. jpg/jpeg write Ultra HDR gain maps; other types encode via sharp. HEIC/HEIF/SVG are input only. Unknown flags error."],
              ["--suffix <str>", "Output filename suffix (default: -gain)"],
              ["-i, --in-place", "Overwrite the original JPEG (implies force)"],
              ["-f, --force", "Overwrite existing outputs"],
              ["--no-clobber", "Skip existing outputs (default)"],
              ["-n, --dry-run", "Print planned paths, write nothing"],
              ["--stdout", "Write one conversion to stdout"],
              ["--stdin", "Read image bytes from stdin"],
              ["-q, --quality <1-100>", "Encode quality for JPEG, WebP, and AVIF (default 92)"],
              ["--boost <0-1>", "HDR boost (default 0.5)"],
              ["--headroom <n>", "Explicit headroom multiplier; overrides --boost"],
              ["--model <name>", "highlight (default) | window"],
              ["--matte <name>", "white (default) | checkerboard"],
              ["--max-size <px>", "Fit longest edge before encode"],
              ["-R, -r, --recursive", "Recurse into directories"],
              ["--ext <list>", "Comma-separated extensions to include"],
              ["--exclude <glob>", "Skip matching paths (repeatable)"],
              ["-j, --jobs <n>", "Parallel conversions (default: CPU count, max 8)"],
              ["-v, --verbose", "Log every file to stderr"],
              ["--quiet", "Errors only"],
              ["--continue", "Keep going after a failed file"],
              ["-h, --help", "Show help"],
              ["-V, --version", "Print version"],
              ["--update / --self-update", "Upgrade CLI when a newer release exists"],
              ["--no-update-check / --offline", "Skip the update check"],
              ["--auto-update", "Auto-update if a newer version exists"],
            ].map(([flag, desc]) => (
              <tr key={flag} className="border-b border-[var(--border)] last:border-b-0">
                <td className="py-2 pr-4 font-mono font-medium text-[var(--foreground)] whitespace-nowrap">{flag}</td>
                <td className="py-2 leading-6">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 font-display text-lg font-semibold tracking-normal">Exit codes</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-2 pr-4 font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Code</th>
              <th className="pb-2 font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Meaning</th>
            </tr>
          </thead>
          <tbody className="text-[var(--muted)]">
            <tr className="border-b border-[var(--border)]">
              <td className="py-2 pr-4 font-mono font-semibold text-[var(--foreground)]">0</td>
              <td className="py-2 leading-6">Success</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="py-2 pr-4 font-mono font-semibold text-[var(--foreground)]">1</td>
              <td className="py-2 leading-6">Conversion error</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono font-semibold text-[var(--foreground)]">2</td>
              <td className="py-2 leading-6">Usage / missing / empty input</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 font-display text-lg font-semibold tracking-normal">File-type contract</h3>
      <div className="mt-3 grid gap-3 text-sm leading-7 text-[var(--muted)]">
        <p>
          By default, every input writes a sibling Ultra HDR JPEG (e.g.{" "}
          <code className={CODE_CLS}>photo.jpg</code> →{" "}
          <code className={CODE_CLS}>photo-gain.jpg</code>; non-JPEG inputs also become{" "}
          <code className={CODE_CLS}>.jpg</code>).
        </p>
        <p>
          Pass <code className={CODE_CLS}>--out dest.webp</code> (or another known extension) to
          write that format via sharp, or use a directory{" "}
          <code className={CODE_CLS}>--out</code> with{" "}
          <code className={CODE_CLS}>--out-type</code>.{" "}
          <code className={CODE_CLS}>jpg</code>/<code className={CODE_CLS}>jpeg</code> still
          embed a gain map; PNG and WebP keep alpha. HEIC/HEIF/SVG are input only. Unknown flags exit 2 as unsupported option.
        </p>
      </div>

      <h3 className="mt-8 font-display text-lg font-semibold tracking-normal">Examples</h3>
      <div className="mt-3 grid gap-2">
        {[
          ["Convert a single JPEG", "gainmap photo.jpg"],
          ["Custom output filename", "gainmap photo.jpg -o hdr.jpg"],
          ["File out as WebP", "gainmap photo.png --out dest.webp"],
          ["Directory out-type WebP", "gainmap photo.png --out ./out --out-type webp"],
          ["Recursive PNG outs", "gainmap -R ./shots --out ./out --out-type png"],
          ["Overwrite JPEG in place", "gainmap -i photo.jpg"],
          ["Convert a whole folder", "gainmap ./shots"],
          ["Recursive with output dir", "gainmap -R ./shots -o ./out"],
          ["Recursive, skip raw subfolder", 'gainmap -R --exclude "**/raw/**" ./shots'],
          ["PNG to JPEG gain map", "gainmap photo.png"],
          ["Max boost, checkerboard matte", "gainmap --boost 1 --matte checkerboard logo.jpg"],
          ["Dry run", "gainmap -n -R ./shots"],
          ["Self-update", "gainmap update"],
        ].map(([label, cmd]) => (
          <div
            key={label}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
              <CopyButton text={cmd} />
            </div>
            <code className="font-mono text-sm text-[var(--foreground)]">{cmd}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

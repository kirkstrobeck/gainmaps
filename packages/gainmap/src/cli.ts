#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { flagBool, flagNumber, flagString, flagStrings, parseArgs } from "#src/args.js";
import { convertPlans, formatError } from "#src/convert.js";
import { collectInputs, parseExtensionList } from "#src/walk.js";
import {
  DEFAULT_SUFFIX,
  isJpegOutputPath,
  isKnownOutputExtension,
  normalizeOutType,
  planInPlace,
  planOutputs,
  stripExtension,
} from "#src/output-path.js";
import { runExtractSdr } from "#src/extract-sdr-cmd.js";
import { checkUpdate, printUpdateNotice, selfUpdate, shouldSkipUpdateCheck } from "#src/update.js";
import { readPackageVersion } from "#src/version.js";

export function usage(): string {
  return `gainmap ${readPackageVersion()} — convert images to Ultra HDR JPEG (ISO 21496-1 gain maps)

Usage
  gainmap [options] <input...>
  gainmap convert [options] <input...>
  gainmap extract-sdr [options] <input>
  gainmap update

Input is a file, a directory, or - for stdin. Directories convert matching
images in that folder. Use -R/--recursive for nested trees.
extract-sdr writes the primary SDR JPEG (first SOI..EOI) from a gain map.

Output
  -o, --out, --output <path>
                        File (single input), directory (required for recursive
                        or multi-file; mirrors source dirs), or - for stdout
      --out-type <type> Output format when --out is a directory (jpg jpeg png
                        webp avif tif tiff gif). File --out uses the extension;
                        --out-type must agree if both are set. jpg/jpeg write
                        Ultra HDR gain maps; other types encode via sharp. Unknown flags error. HEIC/HEIF/SVG are input only.
      --suffix <str>    Default -gain (photo.jpg -> photo-gain.jpg)
  -i, --in-place        Overwrite the original JPEG (implies force)
  -f, --force           Overwrite existing outputs (e.g. photo-gain.jpg)
      --no-clobber      Skip existing outputs (default)
  -n, --dry-run         Print planned paths, write nothing
      --stdout          Write one conversion to stdout
      --stdin           Read image bytes from stdin

Conversion
  -q, --quality <1-100> Encode quality for JPEG, WebP, and AVIF (default 92)
      --boost <0-1>     HDR boost (default 0.5)
      --headroom <n>    Explicit headroom; overrides --boost
      --model <name>    highlight (default) | window
      --matte <name>    white (default) | checkerboard
      --max-size <px>   Fit longest edge before encode

Walk
  -R, -r, --recursive   Recurse into directories (flat-only without this)
      --ext <list>      Comma-separated extensions
      --exclude <glob>  Skip matching paths (repeatable)

Runtime
  -j, --jobs <n>        Parallel conversions (default: CPU count, max 8)
  -v, --verbose         Log every file to stderr
      --quiet           Errors only
      --continue        Keep going after a failed file
  -h, --help            Show this help
  -V, --version         Print version
      --update          Upgrade this CLI when a newer release exists
      --self-update     Same as --update
      --no-update-check Skip the update check
      --offline         Same as --no-update-check
      --auto-update     Auto-update if a newer version exists

Exit codes
  0  success   1  conversion error   2  usage / missing / empty input

Examples
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
  gainmap -R --exclude "**/raw/**" ./shots
  gainmap --boost 1 --matte checkerboard logo.jpg
  gainmap -n -R ./shots
  gainmap extract-sdr photo-gain.jpg -o photo-sdr.jpg
  gainmap update

GitHub: https://github.com/kirkstrobeck/gainmaps.com
Contributions welcome.
`;
}

export const USAGE = usage();

export async function run(argv: readonly string[]): Promise<number> {
  try {
    return await runUnguarded(argv);
  } catch (error) {
    process.stderr.write("error: " + formatError(error) + String.fromCharCode(10));
    return exitCodeFor(error);
  }
}

async function runUnguarded(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);
  const skipCheck = shouldSkipUpdateCheck(process.env, {
    quiet: flagBool(parsed.flags, "quiet"),
    offline: flagBool(parsed.flags, "offline"),
    noUpdateCheck: flagBool(parsed.flags, "no-update-check"),
  });
  const latestPromise = skipCheck ? Promise.resolve(null) : checkUpdate();
  if (flagBool(parsed.flags, "help")) {
    process.stdout.write(usage() + String.fromCharCode(10));
    return finishWithNotice(0, await latestPromise, false);
  }
  if (flagBool(parsed.flags, "version")) {
    process.stdout.write("gainmap " + readPackageVersion() + String.fromCharCode(10));
    return finishWithNotice(0, await latestPromise, false);
  }
  const isUpdateCmd =
    flagBool(parsed.flags, "update") ||
    flagBool(parsed.flags, "self-update") ||
    parsed.positionals[0] === "update";
  if (isUpdateCmd) return selfUpdate();
  const isAutoUpdate = flagBool(parsed.flags, "auto-update") || process.env.GAINMAP_AUTO_UPDATE === "1";
  if (parsed.positionals[0] === "extract-sdr") {
    return finishWithNotice(await runExtractSdr(parsed), await latestPromise, isAutoUpdate);
  }
  const positionals = stripConvert(parsed.positionals);
  const stdin = flagBool(parsed.flags, "stdin") || positionals.includes("-");
  const stdout = flagBool(parsed.flags, "stdout") || flagString(parsed.flags, "output") === "-";
  const inputs = stdin ? ["-"] : positionals;
  if (inputs.length === 0) {
    process.stderr.write("error: missing input" + String.fromCharCode(10)+String.fromCharCode(10) + usage() + String.fromCharCode(10));
    return 2;
  }
  const code = await execute({ argv: parsed, inputs, stdin, stdout });
  return finishWithNotice(code, await latestPromise, isAutoUpdate);
}

async function finishWithNotice(code: number, latest: string | null, autoUpdate: boolean): Promise<number> {
  if (latest == null) return code;
  if (autoUpdate) {
    const updated = await selfUpdate();
    process.stderr.write("Updated. Re-run your command." + String.fromCharCode(10));
    if (updated !== 0) return updated;
    return code;
  }
  printUpdateNotice(readPackageVersion(), latest);
  return code;
}

async function execute(state: {
  argv: ReturnType<typeof parseArgs>;
  inputs: readonly string[];
  stdin: boolean;
  stdout: boolean;
}): Promise<number> {
  const flags = state.argv.flags;
  assertInPlaceAllowed(flags, state.stdin, state.stdout);
  const options = convertOptions(flags);
  const cwd = process.cwd();
  const files = state.stdin ? ["-"] : await collectInputs(state.inputs, {
    recursive: flagBool(flags, "recursive"),
    extensions: parseExtensionList(flagString(flags, "ext")),
    exclude: flagStrings(flags, "exclude"),
  }, cwd);
  if (files.length === 0) throw Object.assign(new Error("no matching images"), { code: "EMPTY" });
  const plans = await plansFor(flags, files, state, cwd);
  const stdinBytes = state.stdin ? await readStdin() : undefined;
  const { failures } = await convertPlans(plans, options, stdinBytes);
  if (failures > 0) return 1;
  return 0;
}

function assertInPlaceAllowed(
  flags: ReturnType<typeof parseArgs>["flags"],
  stdin: boolean,
  stdout: boolean,
): void {
  if (!flagBool(flags, "in-place")) return;
  if (flagString(flags, "output") != null) {
    throw new Error("--in-place must be used without --output");
  }
  if (stdout) {
    throw new Error("--in-place must be used without --stdout");
  }
  if (flagBool(flags, "no-clobber")) {
    throw new Error("--in-place must be used without --no-clobber");
  }
  if (stdin) {
    throw new Error("--in-place requires a file path, not stdin");
  }
}

function assertJpegInputsForInPlace(files: readonly string[]): void {
  const bad = files.find((file) => !isJpegOutputPath(file));
  if (bad == null) return;
  throw new Error(
    "--in-place requires a JPEG input; default copy writes " +
      stripExtension(basename(bad)) +
      "-gain.jpg, or use -o",
  );
}

function resolveSuffix(explicit: string | undefined, outputDest: boolean): string {
  if (outputDest) return explicit ?? "";
  return explicit ?? DEFAULT_SUFFIX;
}

function resolveOutType(
  flags: ReturnType<typeof parseArgs>["flags"],
  output: string | undefined,
  stdout: boolean,
): string | undefined {
  const raw = flagString(flags, "out-type");
  if (raw == null) return undefined;
  const normalized = normalizeOutType(raw);
  if (output == null || output === "-" || stdout) {
    throw new Error("--out-type requires --out/--output");
  }
  return normalized;
}

async function plansFor(
  flags: ReturnType<typeof parseArgs>["flags"],
  files: readonly string[],
  state: { readonly inputs: readonly string[]; readonly stdout: boolean },
  cwd: string,
): Promise<ReturnType<typeof planOutputs>> {
  if (flagBool(flags, "in-place")) {
    assertJpegInputsForInPlace(files);
    return planInPlace(files);
  }
  const output = flagString(flags, "output");
  const outType = resolveOutType(flags, output, state.stdout);
  const usingOutputDest = output != null && output !== "-" && !state.stdout;
  const recursive = flagBool(flags, "recursive");
  const requireDirectory = usingOutputDest && (recursive || files.length > 1);
  if (requireDirectory) await assertDirectoryOutput(output!);
  const root = commonRoot(state.inputs, cwd);
  return planOutputs(files, {
    output,
    suffix: resolveSuffix(flagString(flags, "suffix"), usingOutputDest),
    stdout: state.stdout,
    outputIsDirectory: requireDirectory || (await isDirectory(output, outType)),
    root: recursive ? root : undefined,
    outType,
  });
}

async function assertDirectoryOutput(path: string): Promise<void> {
  if (path.endsWith("/") || path.endsWith(String.fromCharCode(92))) return;
  const info = await statOrNull(path);
  if (info?.isDirectory()) return;
  if (info == null && !isKnownOutputExtension(path)) return;
  throw new Error("--output must be a directory when converting multiple files or using --recursive");
}

async function statOrNull(path: string): Promise<Awaited<ReturnType<typeof stat>> | null> {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

function parseHdrModel(raw: string | undefined): "highlight" | "window" {
  if (raw == null || raw === "highlight") return "highlight";
  if (raw === "window") return "window";
  throw new Error("--model must be highlight or window");
}

function parseMatte(raw: string | undefined): "white" | "checkerboard" {
  if (raw == null || raw === "white") return "white";
  if (raw === "checkerboard") return "checkerboard";
  throw new Error("--matte must be white or checkerboard");
}

function convertOptions(flags: ReturnType<typeof parseArgs>["flags"]) {
  const model = parseHdrModel(flagString(flags, "model"));
  const matte = parseMatte(flagString(flags, "matte"));
  const quality = flagNumber(flags, "quality");
  const boost = flagNumber(flags, "boost");
  const headroom = flagNumber(flags, "headroom");
  const maxSize = flagNumber(flags, "max-size");
  const jobs = flagNumber(flags, "jobs");
  if (quality != null && (quality < 1 || quality > 100)) throw new Error("--quality must be 1-100");
  if (boost != null && (boost < 0 || boost > 1)) throw new Error("--boost must be 0-1");
  if (maxSize != null && maxSize <= 0) throw new Error("--max-size must be positive");
  return {
    dryRun: flagBool(flags, "dry-run"),
    force: flagBool(flags, "force") || flagBool(flags, "in-place"),
    quiet: flagBool(flags, "quiet"),
    verbose: flagBool(flags, "verbose"),
    continueOnError: flagBool(flags, "continue"),
    jobs: clampJobs(jobs),
    quality,
    boost,
    headroom,
    maxSize,
    hdrModel: model,
    matte,
  };
}

function clampJobs(jobs: number | undefined): number {
  const cpus = Math.min(availableParallelism(), 8);
  if (jobs == null) return Math.max(1, cpus);
  return Math.max(1, Math.min(32, Math.floor(jobs)));
}

function stripConvert(positionals: readonly string[]): readonly string[] {
  if (positionals[0] === "convert") return positionals.slice(1);
  return positionals;
}

async function isDirectory(path: string | undefined, outType: string | undefined): Promise<boolean> {
  if (path == null || path === "-") return false;
  if (path.endsWith("/") || path.endsWith(String.fromCharCode(92))) return true;
  const info = await statOrNull(path);
  if (info?.isDirectory()) return true;
  if (info?.isFile()) return false;
  if (isKnownOutputExtension(path)) return false;
  if (outType != null) return true;
  return false;
}

function commonRoot(inputs: readonly string[], cwd: string): string {
  if (inputs.length === 1) return resolve(cwd, inputs[0]!);
  return cwd;
}

async function readStdin(): Promise<Uint8Array> {
  return new Uint8Array(Buffer.concat(await collect(process.stdin)));
}

async function collect(stream: AsyncIterable<Buffer>): Promise<Buffer[]> {
  const iter = stream[Symbol.asyncIterator]();
  return readNext(iter, []);
}

async function readNext(iter: AsyncIterator<Buffer>, acc: readonly Buffer[]): Promise<Buffer[]> {
  const step = await iter.next();
  if (step.done) return [...acc];
  return readNext(iter, [...acc, Buffer.from(step.value)]);
}

export function exitCodeFor(error: unknown): number {
  if (typeof error === "object" && error != null && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "EMPTY" || code === "UNSUPPORTED" || code === "ENOENT") return 2;
  }
  const message = formatError(error);
  if (message.startsWith("missing") || message.includes("requires") || message.includes("must be")) return 2;
  if (message.includes("no matching") || message.toLowerCase().includes("unsupported")) return 2;
  return 1;
}

export function shouldRunMain(main: string | undefined, moduleUrl: string): boolean {
  if (main == null) return false;
  const modulePath = fileURLToPath(moduleUrl);
  const resolvedMain = resolve(main);
  try {
    return realpathSync(modulePath) === realpathSync(resolvedMain);
  } catch {
    return modulePath === resolvedMain;
  }
}

export function reportCrash(error: unknown): void {
  process.stderr.write("error: " + formatError(error) + String.fromCharCode(10));
  process.exitCode = 1;
}

export default async function Base(): Promise<void> {
  const code = await run(process.argv.slice(2));
  if (code !== 0) process.exitCode = code;
}

export function startIfMain(main: string | undefined, url: string, start: () => Promise<void> = Base): void {
  if (!shouldRunMain(main, url)) return;
  start().catch(reportCrash);
}

startIfMain(process.argv[1], import.meta.url);

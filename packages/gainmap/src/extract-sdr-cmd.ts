import { access, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, extname, basename, join } from "node:path";

import { flagBool, flagString, type ParsedArgs } from "#src/args.js";
import { formatError } from "#src/convert.js";
import { extractSdrPrimary } from "#src/extract-sdr.js";
import { assertJpegOutputPath } from "#src/output-path.js";

/**
 * Run `gainmap extract-sdr <input> [-o out.jpg] [--force] [--stdout] [--stdin]`.
 * Reuses the shared -o/--output, --force, and --stdout flags.
 */
export async function runExtractSdr(parsed: ParsedArgs): Promise<number> {
  try {
    return await runExtractSdrUnguarded(parsed);
  } catch (error) {
    process.stderr.write("error: " + formatError(error) + String.fromCharCode(10));
    return exitCodeForExtract(error);
  }
}

async function runExtractSdrUnguarded(parsed: ParsedArgs): Promise<number> {
  const flags = parsed.flags;
  const rest = parsed.positionals.slice(1);
  const stdin = flagBool(flags, "stdin") || rest.includes("-");
  const stdout = flagBool(flags, "stdout") || flagString(flags, "output") === "-";
  const input = stdin ? "-" : rest.find((token) => token !== "-");
  if (input == null) {
    process.stderr.write("error: missing input" + String.fromCharCode(10));
    return 2;
  }
  const inputBytes = stdin ? await readStdin() : await readFile(input);
  const sdr = extractSdrPrimary(new Uint8Array(inputBytes));
  if (stdout) {
    process.stdout.write(sdr);
    return 0;
  }
  const output = flagString(flags, "output") ?? defaultOutputPath(input);
  assertJpegOutputPath(output);
  if (!flagBool(flags, "force") && (await fileExists(output))) {
    process.stderr.write("skip " + input + " -> " + output + String.fromCharCode(10));
    return 0;
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, sdr);
  process.stderr.write(input + " -> " + output + String.fromCharCode(10));
  return 0;
}

function defaultOutputPath(input: string): string {
  const ext = extname(input);
  const base = basename(input, ext);
  return join(dirname(input), base + "-sdr.jpg");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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

function exitCodeForExtract(error: unknown): number {
  const code =
    typeof error === "object" && error != null && "code" in error
      ? (error as { code?: string }).code
      : undefined;
  if (code === "NO_SOI" || code === "NO_EOI" || code === "ENOENT") return 2;
  const message = formatError(error);
  if (message.includes("missing") || message.includes("must be") || message.includes("requires")) {
    return 2;
  }
  return 1;
}

/** Exported for coverage of non-coded error paths. */
export { exitCodeForExtract };


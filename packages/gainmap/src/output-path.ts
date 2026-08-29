import { basename, dirname, extname, join, relative } from "node:path";

export const DEFAULT_SUFFIX = "-gain";

const ALLOWED_OUT_TYPES = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
  "tif",
  "tiff",
  "gif",
  "mp4",
]);

export type OutputPlan = {
  readonly input: string;
  readonly output: string | null;
  readonly stdout: boolean;
};

export function stripExtension(name: string): string {
  const ext = extname(name);
  if (ext === "") return name;
  return name.slice(0, -ext.length);
}

function preservedOrJpegExt(input: string): string {
  const ext = extname(input);
  const lower = ext.toLowerCase();
  if (lower === ".jpg" || lower === ".jpeg" || lower === ".mp4") return ext;
  return ".jpg";
}

export function normalizeOutType(raw: string): string {
  const stripped = raw.trim().replace(/^\./, "").toLowerCase();
  if (stripped === "heic") throw new Error("unsupported --out-type heic: this encoder writes Ultra HDR JPEG. HEIC is input only")
  if (stripped === "heif") throw new Error("unsupported --out-type heif: this encoder writes Ultra HDR JPEG. HEIC is input only")
  if (stripped === "svg") throw new Error("unsupported --out-type svg: SVG is input only")
  if (!ALLOWED_OUT_TYPES.has(stripped)) {
    throw new Error(
      "unsupported --out-type: must be one of: jpg, jpeg, png, webp, avif, tif, tiff, gif, mp4",
    );
  }
  return stripped;
}

export function outputTypeFamily(type: string): string {
  if (type === "jpg" || type === "jpeg") return "jpeg";
  if (type === "tif" || type === "tiff") return "tiff";
  return type;
}

export function typesAgree(a: string, b: string): boolean {
  return outputTypeFamily(a) === outputTypeFamily(b);
}

export function isJpegTypeFamily(type: string): boolean {
  return outputTypeFamily(type) === "jpeg";
}

export function typeFromOutputPath(path: string): string | undefined {
  const ext = extname(path).toLowerCase().replace(/^\./, "");
  if (!ALLOWED_OUT_TYPES.has(ext)) return undefined;
  return ext;
}

export function isKnownOutputExtension(path: string): boolean {
  return typeFromOutputPath(path) != null;
}

export function extensionForOutType(type: string): string {
  return "." + type;
}

export function isJpegOutputPath(path: string): boolean {
  const type = typeFromOutputPath(path);
  if (type == null) return false;
  return isJpegTypeFamily(type);
}

export function assertJpegOutputPath(path: string): void {
  if (isJpegOutputPath(path)) return;
  throw Object.assign(
    new Error("Ultra HDR requires a JPEG path (.jpg / .jpeg)"),
    { code: "UNSUPPORTED" },
  );
}

export function assertFileOutputPath(path: string, outType?: string): void {
  const ext = extname(path).toLowerCase().replace(/^\./, "")
  if (ext === "heic") throw new Error("unsupported output heic: this encoder writes Ultra HDR JPEG. HEIC is input only")
  if (ext === "heif") throw new Error("unsupported output heif: this encoder writes Ultra HDR JPEG. HEIC is input only")
  if (ext === "svg") throw new Error("unsupported output svg: SVG is input only")
  const fromPath = typeFromOutputPath(path);
  if (fromPath == null) {
    throw new Error(
      "unsupported output extension: must be jpg, jpeg, png, webp, avif, tif, tiff, gif, or mp4",
    );
  }
  if (outType != null && !typesAgree(fromPath, outType)) {
    throw new Error("--out-type must be consistent with the --out file extension");
  }
  if (isJpegTypeFamily(fromPath)) {
    assertJpegOutputPath(path);
  }
}

export function defaultOutputPath(input: string, suffix = DEFAULT_SUFFIX): string {
  return join(dirname(input), stripExtension(basename(input)) + suffix + preservedOrJpegExt(input));
}

export function planOutputs(
  inputs: readonly string[],
  options: {
    readonly output?: string;
    readonly suffix: string;
    readonly stdout: boolean;
    readonly outputIsDirectory: boolean;
    readonly root?: string;
    readonly outType?: string;
  },
): readonly OutputPlan[] {
  if (options.stdout) {
    if (inputs.length !== 1) throw new Error("--stdout requires exactly one input");
    return [{ input: inputs[0]!, output: null, stdout: true }];
  }
  if (options.output == null) {
    return inputs.map((input) => ({ input, output: defaultOutputPath(input, options.suffix), stdout: false }));
  }
  if (options.output === "-") {
    if (inputs.length !== 1) throw new Error("-o - requires exactly one input");
    return [{ input: inputs[0]!, output: null, stdout: true }];
  }
  if (inputs.length === 1 && !options.outputIsDirectory) {
    assertFileOutputPath(options.output, options.outType);
    return [{ input: inputs[0]!, output: options.output, stdout: false }];
  }
  return inputs.map((input) => ({
    input,
    output: join(options.output!, relativeOutput(input, options.root, options.suffix, options.outType)),
    stdout: false,
  }));
}

export function planInPlace(inputs: readonly string[]): readonly OutputPlan[] {
  return inputs.map((input) => ({ input, output: input, stdout: false }));
}

function relativeOutput(
  input: string,
  root: string | undefined,
  suffix: string,
  outType: string | undefined,
): string {
  const ext = outType != null ? extensionForOutType(outType) : preservedOrJpegExt(input);
  const base = stripExtension(basename(input)) + suffix + ext;
  if (root == null) return base;
  const rel = relative(root, dirname(input));
  if (!rel) return base;
  return join(rel, base);
}

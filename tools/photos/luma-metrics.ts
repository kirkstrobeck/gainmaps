/**
 * Rec.709 luminance on 0..1 sRGB channel values (NOT linearized).
 * Matches /tmp/luma.ts and the GOAL 24 photo audit.
 */
import sharp from "sharp";

export const WHITE_Y = 0.9;
export const BRIGHT_Y = 0.75;
export const P99_MIN = 0.9;
export const WHITE_FRAC_MIN = 0.01;
export const SELECT_P99_MIN = 0.95;
export const SELECT_WHITE_FRAC_MIN = 0.05;

export type LumaMetrics = {
  readonly maxLuma: number;
  readonly p99Luma: number;
  readonly p95Luma: number;
  readonly whiteFrac: number;
  readonly brightFrac: number;
  readonly pixelCount: number;
};

function rec709(r: number, g: number, b: number): number {
  return 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx]!;
}

function lumasFromRaw(data: Buffer, channels: number): readonly number[] {
  const pixelCount = Math.floor(data.length / channels);
  return Array.from({ length: pixelCount }, (_, index) => {
    const offset = index * channels;
    return rec709(data[offset]!, data[offset + 1]!, data[offset + 2]!);
  });
}

export function metricsFromLumas(lumas: readonly number[]): LumaMetrics {
  const maxLuma = lumas.reduce((acc, y) => (y > acc ? y : acc), 0);
  const n = lumas.length;
  return {
    maxLuma,
    p99Luma: percentile(lumas, 0.99),
    p95Luma: percentile(lumas, 0.95),
    whiteFrac: n === 0 ? 0 : lumas.filter((y) => y >= WHITE_Y).length / n,
    brightFrac: n === 0 ? 0 : lumas.filter((y) => y >= BRIGHT_Y).length / n,
    pixelCount: n,
  };
}

export async function measureJpeg(input: Buffer | string, edge = 320): Promise<LumaMetrics> {
  const { data, info } = await sharp(input)
    .resize(edge, edge, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return metricsFromLumas(lumasFromRaw(data, info.channels ?? 3));
}

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(4);
}

export function clearsPassRule(m: LumaMetrics): boolean {
  return m.p99Luma >= P99_MIN && m.whiteFrac >= WHITE_FRAC_MIN;
}

export function clearsSelectionBar(m: LumaMetrics): boolean {
  return m.p99Luma >= SELECT_P99_MIN && m.whiteFrac >= SELECT_WHITE_FRAC_MIN;
}

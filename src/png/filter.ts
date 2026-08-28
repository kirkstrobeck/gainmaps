/**
 * Forward scanline filters — the encode side of `decode.ts`'s unfilter. PNG
 * picks one per row; the standard heuristic is to try all five and keep whichever
 * leaves the smallest signed sum, since flatter residuals deflate better.
 */

export const FILTER_TYPES = [0, 1, 2, 3, 4] as const;

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Predicted value for byte `i` under `type`, given the row above and to the left. */
function predict(type: number, row: Buffer, previous: Buffer, bpp: number, i: number): number {
  const left = i >= bpp ? row[i - bpp]! : 0;
  const up = previous[i]!;
  const upLeft = i >= bpp ? previous[i - bpp]! : 0;

  if (type === 1) return left;
  if (type === 2) return up;
  if (type === 3) return (left + up) >> 1;
  if (type === 4) return paeth(left, up, upLeft);
  return 0;
}

export function filterRow(
  type: number,
  row: Buffer,
  previous: Buffer,
  bpp: number,
  out: Buffer,
): void {
  for (let i = 0; i < row.length; i += 1) {
    out[i] = (row[i]! - predict(type, row, previous, bpp, i)) & 0xff;
  }
}

/** Sum of residual magnitudes, treating bytes as signed — the usual cost proxy. */
function cost(filtered: Buffer): number {
  let total = 0;
  for (const byte of filtered) total += byte < 128 ? byte : 256 - byte;
  return total;
}

/** Filter a row with every type and return the cheapest, with its type byte. */
export function bestFilteredRow(row: Buffer, previous: Buffer, bpp: number): Buffer {
  let best: Buffer | null = null;
  let bestCost = Infinity;

  for (const type of FILTER_TYPES) {
    const candidate = Buffer.alloc(row.length + 1);
    candidate[0] = type;
    filterRow(type, row, previous, bpp, candidate.subarray(1));

    const candidateCost = cost(candidate.subarray(1));
    if (candidateCost >= bestCost) continue;
    bestCost = candidateCost;
    best = candidate;
  }

  /* v8 ignore next -- FILTER_TYPES is a fixed non-empty tuple. */
  if (!best) throw new Error('Unreachable: no filter candidate produced');
  return best;
}

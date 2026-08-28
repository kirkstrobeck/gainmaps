import type { FrameMetrics } from "./types.js";

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computeMetrics(timestamps: number[]): FrameMetrics | null {
  if (timestamps.length < 2) return null;

  const deltas: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    deltas.push(timestamps[i] - timestamps[i - 1]);
  }

  const sorted = [...deltas].sort((a, b) => a - b);
  const frameCount = deltas.length;
  const wallDurationMs = timestamps[timestamps.length - 1] - timestamps[0];
  const meanFps = frameCount / (wallDurationMs / 1000);

  return {
    frameCount,
    wallDurationMs,
    meanFps,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    framesOver16_7: deltas.filter((d) => d > 16.7).length,
    framesOver33_3: deltas.filter((d) => d > 33.3).length,
    worstFrameMs: sorted[sorted.length - 1],
  };
}

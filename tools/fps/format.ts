import type { FrameMetrics, ScenarioRun, EnvInfo } from "./types.js";

function fmtMetrics(m: FrameMetrics): string {
  return [
    `  frameCount:      ${m.frameCount}`,
    `  wallDurationMs:  ${m.wallDurationMs.toFixed(3)}`,
    `  meanFps:         ${m.meanFps.toFixed(6)}`,
    `  p50Ms:           ${m.p50Ms.toFixed(6)}`,
    `  p95Ms:           ${m.p95Ms.toFixed(6)}`,
    `  p99Ms:           ${m.p99Ms.toFixed(6)}`,
    `  framesOver16_7:  ${m.framesOver16_7}`,
    `  framesOver33_3:  ${m.framesOver33_3}`,
    `  worstFrameMs:    ${m.worstFrameMs.toFixed(6)}`,
  ].join("\n");
}

export function formatEnv(env: EnvInfo): string {
  return [
    `headless:       ${env.headless}`,
    `gpuRasterOn:    ${env.gpuRasterOn}`,
    `webGpuAvailable: ${env.webGpuAvailable}`,
    `userAgent:      ${env.chromeVersion}`,
  ].join("\n");
}

export function formatRun(r: ScenarioRun): string {
  if (r.error) {
    return `[${r.scenario} run ${r.run}] ERROR: ${r.error}`;
  }
  if (!r.metrics) {
    return `[${r.scenario} run ${r.run}] NOT MEASURED: insufficient frames`;
  }
  return `[${r.scenario} run ${r.run}]\n${fmtMetrics(r.metrics)}`;
}

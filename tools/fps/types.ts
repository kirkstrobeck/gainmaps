export interface FrameMetrics {
  frameCount: number;
  wallDurationMs: number;
  meanFps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  framesOver16_7: number;
  framesOver33_3: number;
  worstFrameMs: number;
}

export interface ScenarioRun {
  scenario: string;
  run: number;
  metrics: FrameMetrics | null;
  error?: string;
}

export interface EnvInfo {
  headless: boolean;
  gpuRasterOn: boolean;
  webGpuAvailable: boolean;
  chromeVersion: string;
}

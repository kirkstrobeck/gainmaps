const MIN_EDGE = 1024;
const MAX_EDGE = 4096;

export function isSvgFile(file: File): boolean {
  if (file.type === "image/svg+xml") return true;
  return /\.svg$/i.test(file.name);
}

export function isAnimatedSvg(svgText: string): boolean {
  if (/<(animate|animateTransform|animateMotion|set)\b/i.test(svgText)) return true;
  if (/@keyframes/i.test(svgText)) return true;
  if (/\banimation(?:-name)?\s*:/i.test(svgText)) return true;
  return false;
}

export function parseSvgLength(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) return null;
  const match = /^([\d.]+)/.exec(trimmed);
  if (!match) return null;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

export function viewBoxSize(viewBox: string | null): { width: number; height: number } | null {
  if (!viewBox) return null;
  const parts = viewBox.trim().split(/[\s,]+/).map(Number);
  const width = parts[2];
  const height = parts[3];
  if (!width || !height || width <= 0 || height <= 0) return null;
  return { width, height };
}

export function clampRasterSize(width: number, height: number): { width: number; height: number } {
  const minEdge = Math.min(width, height);
  const scaleUp = minEdge < MIN_EDGE ? MIN_EDGE / minEdge : 1;
  const scaledWidth = width * scaleUp;
  const scaledHeight = height * scaleUp;
  const scaledMax = Math.max(scaledWidth, scaledHeight);
  const scaleDown = scaledMax > MAX_EDGE ? MAX_EDGE / scaledMax : 1;
  return {
    width: Math.max(1, Math.round(scaledWidth * scaleDown)),
    height: Math.max(1, Math.round(scaledHeight * scaleDown)),
  };
}

export function parseClock(value: string | null): number {
  if (!value) return 0;
  const match = value.trim().match(/^([\d.]+)(ms|s)?$/i);
  if (!match) return 0;
  const numeric = Number(match[1]);
  /* v8 ignore next */
  if (!Number.isFinite(numeric)) return 0;
  return match[2]?.toLowerCase() === "ms" ? numeric / 1000 : numeric;
}

export function parseList(value: string | null): string[] {
  if (!value) return [];
  return value.split(";").map((part) => part.trim()).filter(Boolean);
}

export function keyframeIndex(progress: number, keyTimes: number[]): number {
  let index = 0;
  for (let i = 0; i < keyTimes.length; i += 1) {
    if (keyTimes[i]! <= progress + 1e-9) index = i;
  }
  return index;
}

export function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

import {
  clampRasterSize,
  keyframeIndex,
  parseClock,
  parseList,
  parseSvgLength,
  viewBoxSize,
} from "@/lib/svg-raster-pure";

export function parseSvgRoot(svgText: string): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = parsed.documentElement;
  if (root.tagName.toLowerCase() === "parsererror" || root.querySelector("parsererror")) {
    throw new Error("SVG could not be parsed.");
  }
  if (root.tagName.toLowerCase() !== "svg") {
    throw new Error("File is not a valid SVG document.");
  }
  return root as unknown as SVGSVGElement;
}

export function sanitizeSvgRoot(svgText: string): SVGSVGElement {
  const root = parseSvgRoot(svgText);
  root.querySelectorAll("script").forEach((node) => node.remove());
  for (const element of Array.from(root.querySelectorAll("*"))) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
    }
  }
  return root;
}

export function serializeSvgRoot(root: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(root);
}

export function prepareSvgRoot(
  svgText: string,
  size: { width: number; height: number },
): SVGSVGElement {
  const root = sanitizeSvgRoot(svgText);
  root.setAttribute("width", String(size.width));
  root.setAttribute("height", String(size.height));
  if (!root.getAttribute("viewBox")) {
    root.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
  }
  root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  /* v8 ignore next */
  if (!root.getAttribute("xmlns:xlink")) {
    root.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }
  return root;
}

function progressAt(element: Element, seconds: number): number {
  const begin = parseClock(element.getAttribute("begin"));
  const duration = parseClock(element.getAttribute("dur"));
  /* v8 ignore next */
  if (duration <= 0) return 0;
  const elapsed = seconds - begin;
  /* v8 ignore next 4 */
  const cycle =
    element.getAttribute("repeatCount") === "indefinite"
      ? ((elapsed % duration) + duration) % duration
      : Math.min(Math.max(elapsed, 0), duration);
  return Math.min(Math.max(cycle / duration, 0), 1);
}

function valueAt(element: Element, seconds: number): string | null {
  const values = parseList(element.getAttribute("values"));
  if (!values.length) return element.getAttribute("to");
  const rawTimes = parseList(element.getAttribute("keyTimes")).map(Number);
  const keyTimes =
    rawTimes.length === values.length
      ? rawTimes
      : values.map((_, index) => index / Math.max(values.length - 1, 1));
  /* v8 ignore next */
  return values[keyframeIndex(progressAt(element, seconds), keyTimes)] ?? null;
}

function transformFromAnimateTransform(element: Element, seconds: number): string | null {
  const value = valueAt(element, seconds);
  if (!value) return null;
  const type = element.getAttribute("type") || "translate";
  const parts = value.trim().split(/[\s,]+/).map(Number);
  if (type === "translate") return `translate(${parts[0] || 0} ${parts[1] || 0})`;
  if (type === "scale") {
    if (parts.length > 1) return `scale(${parts[0]} ${parts[1]})`;
    return `scale(${parts[0] || 1})`;
  }
  if (type === "rotate") {
    if (parts.length >= 3) return `rotate(${parts[0]} ${parts[1]} ${parts[2]})`;
    return `rotate(${parts[0] || 0})`;
  }
  if (type === "skewX") return `skewX(${parts[0] || 0})`;
  if (type === "skewY") return `skewY(${parts[0] || 0})`;
  return null;
}

function pickSampleSeconds(root: SVGSVGElement): number {
  const DEFAULT_SAMPLE_PROGRESS = 0.25;
  const nodes = Array.from(root.querySelectorAll("animate, animateTransform, animateMotion, set"));
  if (!nodes.length) return 0;
  const durations = nodes.map((node) => parseClock(node.getAttribute("dur"))).filter((v) => v > 0);
  const duration = durations.length ? Math.max(...durations) : 1;
  const keyTimes = nodes
    .flatMap((node) => parseList(node.getAttribute("keyTimes")).map(Number))
    .filter((v) => Number.isFinite(v) && v > 0 && v < 1);
  if (keyTimes.length) return Math.min(...keyTimes) * duration;
  return duration * DEFAULT_SAMPLE_PROGRESS;
}

function freezeSmilTree(root: SVGSVGElement, seconds: number): void {
  for (const element of Array.from(root.querySelectorAll("animateTransform"))) {
    const parent = element.parentElement;
    const transform = transformFromAnimateTransform(element, seconds);
    if (parent && transform) parent.setAttribute("transform", transform);
    element.remove();
  }
  for (const element of Array.from(root.querySelectorAll("animate"))) {
    const parent = element.parentElement;
    const attributeName = element.getAttribute("attributeName");
    const value = valueAt(element, seconds);
    if (parent && attributeName && value != null) parent.setAttribute(attributeName, value);
    element.remove();
  }
  for (const element of Array.from(root.querySelectorAll("animateMotion, set"))) {
    element.remove();
  }
}

export function svgRasterSize(svgText: string): { width: number; height: number } {
  const root = parseSvgRoot(svgText);
  const width = parseSvgLength(root.getAttribute("width"));
  const height = parseSvgLength(root.getAttribute("height"));
  if (width && height) return clampRasterSize(width, height);
  const fromViewBox = viewBoxSize(root.getAttribute("viewBox"));
  if (fromViewBox) return clampRasterSize(fromViewBox.width, fromViewBox.height);
  if (width) return clampRasterSize(width, width);
  if (height) return clampRasterSize(height, height);
  return { width: 1024, height: 1024 };
}

export function previewSvgMarkup(svgText: string): string {
  const root = sanitizeSvgRoot(svgText);
  const width = parseSvgLength(root.getAttribute("width"));
  const height = parseSvgLength(root.getAttribute("height"));
  const fromViewBox = viewBoxSize(root.getAttribute("viewBox"));
  root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!fromViewBox && width && height) {
    root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  root.setAttribute("width", "100%");
  root.setAttribute("height", "100%");
  root.setAttribute("preserveAspectRatio", "xMidYMid meet");
  return serializeSvgRoot(root);
}

export function freezeAnimatedSvgMarkup(
  svgText: string,
  size: { width: number; height: number },
  sampleSeconds?: number,
): string {
  const root = prepareSvgRoot(svgText, size);
  const seconds = sampleSeconds ?? pickSampleSeconds(root);
  freezeSmilTree(root, seconds);
  return serializeSvgRoot(root);
}

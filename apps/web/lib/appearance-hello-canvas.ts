import { FONT, LABEL, fieldRgb, type HelloState } from "@/lib/appearance-hello-pure";

export function readState(lab: HTMLElement): HelloState {
  const ultra = lab.dataset.ultra === "on";
  const resolved = lab.dataset.resolved === "light" ? "light" : "dark";
  const raw = Number(lab.style.getPropertyValue("--ultra-scale") || "1");
  const scale = Number.isFinite(raw) && raw > 0 ? raw : 1;
  return { ultra, resolved, scale };
}

export function syncCanvasSize(canvas: HTMLCanvasElement, width: number, height: number): boolean {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.floor(width * dpr));
  const h = Math.max(1, Math.floor(height * dpr));
  if (canvas.width === w && canvas.height === h) return false;
  canvas.width = w;
  canvas.height = h;
  return true;
}

export function paintMask(
  pixelW: number,
  pixelH: number,
  cssW: number,
  cssH: number,
  helloY: number,
): HTMLCanvasElement {
  const bitmap = document.createElement("canvas");
  bitmap.width = pixelW;
  bitmap.height = pixelH;
  const ctx = bitmap.getContext("2d");
  if (!ctx) return bitmap;
  ctx.setTransform(pixelW / cssW, 0, 0, pixelH / cssH, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = "#ffffff";
  ctx.font = FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(LABEL, cssW / 2, helloY);
  return bitmap;
}

export function helloCenterY(lab: HTMLElement, cssH: number): number {
  const main = lab.querySelector(".appearance-main");
  if (!main) return cssH / 2;
  const labRect = lab.getBoundingClientRect();
  const mainRect = main.getBoundingClientRect();
  return mainRect.top - labRect.top + mainRect.height / 2;
}

export function paintHello2d(canvas: HTMLCanvasElement, lab: HTMLElement): void {
  const cssW = Math.max(1, lab.clientWidth);
  const cssH = Math.max(1, lab.clientHeight);
  syncCanvasSize(canvas, cssW, cssH);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const state = readState(lab);
  const field = fieldRgb(state);
  const dpr = canvas.width / cssW;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle =
    state.resolved === "dark"
      ? "#000000"
      : `rgb(${Math.round(field.r * 255)} ${Math.round(field.g * 255)} ${Math.round(field.b * 255)})`;
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.font = FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = state.resolved === "light" ? "#1c1c1e" : "#ffffff";
  ctx.fillText(LABEL, cssW / 2, helloCenterY(lab, cssH));
}

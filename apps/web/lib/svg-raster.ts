import { isAnimatedSvg, isSvgFile, stripExtension } from "@/lib/svg-raster-pure";
import {
  freezeAnimatedSvgMarkup,
  prepareSvgRoot,
  serializeSvgRoot,
  svgRasterSize,
} from "@/lib/svg-raster-dom";

export { isSvgFile } from "@/lib/svg-raster-pure";
export { previewSvgMarkup, svgRasterSize, freezeAnimatedSvgMarkup } from "@/lib/svg-raster-dom";

export async function rasterizeSvgToPng(file: File): Promise<File> {
  const svgText = await file.text();
  const size = svgRasterSize(svgText);
  const markup = isAnimatedSvg(svgText)
    ? freezeAnimatedSvgMarkup(svgText, size)
    : serializeSvgRoot(prepareSvgRoot(svgText, size));
  const png = await rasterizeStaticSvgMarkup(markup, size);
  return new File([png], `${stripExtension(file.name)}.png`, { type: "image/png" });
}

async function rasterizeStaticSvgMarkup(
  markup: string,
  size: { width: number; height: number },
): Promise<Blob> {
  const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await decodeSvgImage(url);
    return canvasFromImage(image, size.width, size.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function decodeSvgImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Browser could not decode this SVG."));
    image.src = url;
  });
}

async function canvasFromImage(
  image: HTMLImageElement,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create a canvas to rasterize SVG.");
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvasToPng(canvas);
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("SVG rasterization failed."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

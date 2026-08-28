export type HelloState = {
  ultra: boolean;
  resolved: "light" | "dark";
  scale: number;
};

export type Rgb = { r: number; g: number; b: number };

export const UNIFORM_FLOATS = 12;
export const LABEL = "Ultra";
export const FONT = "700 64px ui-sans-serif, system-ui, sans-serif";

export function srgb8ToLinear(channel: number): number {
  const x = channel / 255;
  if (x <= 0.04045) return x / 12.92;
  return Math.pow((x + 0.055) / 1.055, 2.4);
}

/** Page wash — light Ultra is pigment × intensity; dark stays true black. */
export function fieldRgb(state: HelloState): Rgb {
  if (state.resolved === "dark") return { r: 0, g: 0, b: 0 };
  const base = srgb8ToLinear(0xf2);
  const gain = state.ultra && state.scale > 1 ? state.scale : 1;
  return { r: base * gain, g: base * gain, b: base * gain };
}

/** Glyph ink — dark Ultra is HDR white; light stays near-black for contrast. */
export function inkRgb(state: HelloState): Rgb {
  if (state.resolved === "light") {
    return { r: srgb8ToLinear(0x1c), g: srgb8ToLinear(0x1c), b: srgb8ToLinear(0x1e) };
  }
  return { r: 1, g: 1, b: 1 };
}

export function inkScale(state: HelloState): number {
  if (state.resolved === "dark" && state.ultra && state.scale > 1) return state.scale;
  return 1;
}

export function packUniform(
  width: number,
  height: number,
  glyphScale: number,
  field: Rgb,
  ink: Rgb,
): Float32Array {
  const data = new Float32Array(UNIFORM_FLOATS);
  data[0] = width;
  data[1] = height;
  data[2] = glyphScale;
  data[3] = 0;
  data[4] = field.r;
  data[5] = field.g;
  data[6] = field.b;
  data[7] = 1;
  data[8] = ink.r;
  data[9] = ink.g;
  data[10] = ink.b;
  data[11] = 0;
  return data;
}

// Ultra mode by Kirk Strobeck – https://UltraDarkMode.com

/*
  The geometry both Ultra layers share.

  A word is drawn by two absolutely-positioned siblings of the text: the mask
  <svg> and the fill canvas. They must be the *same rectangle*, because the
  mask's <text x="50%" y="50%"> centres itself in the svg viewport while the
  fill is painted in the canvas's box — give them different boxes and the
  glyphs drift off the word.

  That shared rectangle is the word's box grown by ULTRA_BLEED on every side,
  so ink that escapes the box (accents, descenders, round overshoot on G/O/Q
  under tight leading, italic overhang) still has mask to live in. The growth is
  symmetric, so the centre does not move and the glyphs stay where the text is.

  Stating a width and a height is not redundant with the inset. An <svg> is a
  replaced element: with width:auto it keeps its 300x150 default size and the
  right/bottom insets are simply dropped, which silently shifts the mask.
*/

/** How far past the word's box, as a fraction of it, both layers grow. */
export const ULTRA_BLEED = 0.5;

const percent = (value: number) => `${Number((value * 100).toFixed(4))}%`;

export type UltraOverlayGeometry = {
  position: "absolute";
  inset: string;
  width: string;
  height: string;
};

export function ultraOverlayGeometry(bleed: number = ULTRA_BLEED): UltraOverlayGeometry {
  const span = percent(1 + bleed * 2);
  return { position: "absolute", inset: percent(-bleed), width: span, height: span };
}

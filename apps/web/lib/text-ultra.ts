/**
 * Linear headroom for UltraWord / UltraIcon.
 * 1.0 = SDR reference white; ~2.2 mild; 4.0 aggressive.
 */

export const TEXT_ULTRA_HEADROOM_MIN = 1;
export const TEXT_ULTRA_HEADROOM_MAX = 4;
export const TEXT_ULTRA_FOUNDATION_RATIO = 0.75;

export function foundationHeadroomFor(headroom: number): number {
  if (!Number.isFinite(headroom)) return TEXT_ULTRA_INTENSITY * TEXT_ULTRA_FOUNDATION_RATIO;
  return headroom * TEXT_ULTRA_FOUNDATION_RATIO;
}

/** Default intensity — at max headroom. */
export const TEXT_ULTRA_INTENSITY = TEXT_ULTRA_HEADROOM_MAX;

const HEADROOM_SPAN = TEXT_ULTRA_HEADROOM_MAX - TEXT_ULTRA_HEADROOM_MIN;

export function headroomToSlider(headroom: number): number {
  if (!Number.isFinite(headroom)) return 70;
  const t = (headroom - TEXT_ULTRA_HEADROOM_MIN) / HEADROOM_SPAN;
  return Math.min(100, Math.max(0, Math.round(t * 100)));
}

export const TEXT_ULTRA_SLIDER_DEFAULT = headroomToSlider(TEXT_ULTRA_INTENSITY);

function clampSlider(value: number): number {
  if (!Number.isFinite(value)) return TEXT_ULTRA_SLIDER_DEFAULT;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function sliderToHeadroom(slider: number): number {
  return TEXT_ULTRA_HEADROOM_MIN + (clampSlider(slider) / 100) * HEADROOM_SPAN;
}

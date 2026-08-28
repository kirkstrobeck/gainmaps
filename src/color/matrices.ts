/**
 * RGB -> XYZ matrices, D65. The primaries are what stretch colour distances:
 * the same code triple lands much further apart in Rec.2020 than in sRGB,
 * which is why an edge that was smoothly anti-aliased starts to look stepped.
 */

export type Matrix3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

export const SRGB_TO_XYZ: Matrix3 = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
];

export const REC2020_TO_XYZ: Matrix3 = [
  [0.636958, 0.1446169, 0.1688809],
  [0.2627002, 0.6779981, 0.0593017],
  [0.0, 0.0280727, 1.0609851],
];

export type Triplet = [number, number, number];

export function applyMatrix(matrix: Matrix3, rgb: Triplet): Triplet {
  return [
    matrix[0][0] * rgb[0] + matrix[0][1] * rgb[1] + matrix[0][2] * rgb[2],
    matrix[1][0] * rgb[0] + matrix[1][1] * rgb[1] + matrix[1][2] * rgb[2],
    matrix[2][0] * rgb[0] + matrix[2][1] * rgb[1] + matrix[2][2] * rgb[2],
  ];
}

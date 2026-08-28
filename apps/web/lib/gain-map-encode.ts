export {
  DEFAULT_PHOTO_HEADROOM,
  WINDOW_GAIN_CALIBRATION,
  applyHighlightSelectiveHdr,
  applyWindowGainCalibration,
  encodeKeepBaseGainMap,
  encodeRgbaToUltraHdrJpeg,
  flattenRgbaOntoCheckerboard,
  flattenRgbaOntoWhite,
  headroomFromBoost,
} from "gainmap/encode";
export type {
  GainMapEncodeOptions,
  GainMapEncodeResult,
  GainMapHdrModel,
} from "gainmap/encode";

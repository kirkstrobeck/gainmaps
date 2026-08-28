const SUFFIX = "-gainmap";

export type OutputNameResult = {
  name: string;
  ext: string;
  converted: boolean;
  fromLabel: string | null;
};

export function outputName(fileName: string): OutputNameResult {
  const lastDot = fileName.lastIndexOf(".");
  const ext = lastDot === -1 ? "" : fileName.slice(lastDot);
  const lower = ext.toLowerCase();
  const base = lastDot === -1 ? fileName : fileName.slice(0, lastDot);

  if (lower === ".jpg" || lower === ".jpeg") {
    return { name: `${base}${SUFFIX}${ext}`, ext, converted: false, fromLabel: null };
  }

  const fromLabel = ext === "" ? "UNKNOWN" : ext.slice(1).toUpperCase();
  return { name: `${base}${SUFFIX}.jpg`, ext: ".jpg", converted: true, fromLabel };
}

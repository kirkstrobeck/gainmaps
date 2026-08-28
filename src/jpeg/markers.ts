/** JPEG marker constants and classification helpers. */

export const SOI = 0xd8;
export const EOI = 0xd9;
export const SOS = 0xda;
export const APP0 = 0xe0;
export const APP1 = 0xe1;
export const APP2 = 0xe2;
export const TEM = 0x01;
export const RST_FIRST = 0xd0;
export const RST_LAST = 0xd7;

/** Markers that carry no length field or payload. */
export function isStandalone(marker: number): boolean {
  if (marker === TEM) return true;
  if (marker >= RST_FIRST && marker <= RST_LAST) return true;
  return marker === SOI || marker === EOI;
}

/** Markers after which the remainder of the file is entropy-coded scan data. */
export function isTerminal(marker: number): boolean {
  return marker === SOS || marker === EOI;
}

export function markerName(marker: number): string {
  if (marker >= APP0 && marker <= 0xef) return `APP${marker - APP0}`;
  const names: Record<number, string> = {
    [SOI]: 'SOI',
    [EOI]: 'EOI',
    [SOS]: 'SOS',
    0xdb: 'DQT',
    0xc4: 'DHT',
    0xc0: 'SOF0',
    0xc2: 'SOF2',
    0xdd: 'DRI',
    0xfe: 'COM',
  };
  return names[marker] ?? `0x${marker.toString(16).toUpperCase()}`;
}

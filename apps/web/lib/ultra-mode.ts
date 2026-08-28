export type UltraMode = "on" | "off";

export const ULTRA_MODE_STORAGE_KEY = "ultra-mode";
/*
  Newest first. Writes only ever use the first key; the rest are read so a
  visitor who chose Off under an earlier name keeps that choice. The same list
  is inlined in the boot script in app/layout.tsx — change both together.
*/
export const ULTRA_MODE_STORAGE_KEYS = [
  ULTRA_MODE_STORAGE_KEY,
  "hdr-lab-ultra-mode",
  "hdr-lab-gainmap-mode",
];
export const ULTRA_MODE_EVENT = "ultra-mode";
export const DEFAULT_ULTRA_MODE: UltraMode = "on";

export function isUltraMode(value: string | null | undefined): value is UltraMode {
  return value === "on" || value === "off";
}

export function readUltraMode(): UltraMode {
  if (typeof window === "undefined") return DEFAULT_ULTRA_MODE;
  try {
    for (const key of ULTRA_MODE_STORAGE_KEYS) {
      const stored = window.localStorage.getItem(key);
      if (isUltraMode(stored)) return stored;
    }
  } catch {
    return DEFAULT_ULTRA_MODE;
  }
  return DEFAULT_ULTRA_MODE;
}

export function applyUltraMode(mode: UltraMode): void {
  document.documentElement.dataset.ultra = mode;
}

export function writeUltraMode(mode: UltraMode): void {
  applyUltraMode(mode);
  try {
    window.localStorage.setItem(ULTRA_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore quota / private-mode failures; the live DOM attribute still applies.
  }
  window.dispatchEvent(new CustomEvent(ULTRA_MODE_EVENT, { detail: mode }));
}

import { expect } from "vitest";

export function srcsetWidths(srcset: string): string[] {
  return (srcset.match(/\d+w/g) ?? []).slice().sort();
}

export function assertPairParity(sdr: Element, ultra: Element): void {
  expect(sdr.getAttribute("sizes")).toBe(ultra.getAttribute("sizes"));
  expect(srcsetWidths(sdr.getAttribute("srcset") ?? "")).toEqual(
    srcsetWidths(ultra.getAttribute("srcset") ?? ""),
  );
}

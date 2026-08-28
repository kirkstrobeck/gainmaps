import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_ULTRA_MODE,
  ULTRA_MODE_EVENT,
  isUltraMode,
  readUltraMode,
  applyUltraMode,
  writeUltraMode,
  ULTRA_MODE_STORAGE_KEY,
  ULTRA_MODE_STORAGE_KEYS,
} from "@/lib/ultra-mode";

describe("isUltraMode", () => {
  it("accepts 'on'", () => expect(isUltraMode("on")).toBe(true));
  it("accepts 'off'", () => expect(isUltraMode("off")).toBe(true));
  it("rejects null", () => expect(isUltraMode(null)).toBe(false));
  it("rejects undefined", () => expect(isUltraMode(undefined)).toBe(false));
  it("rejects other string", () => expect(isUltraMode("yes")).toBe(false));
});

describe("readUltraMode", () => {
  beforeEach(() => localStorage.clear());

  it("returns default when no storage value", () => {
    expect(readUltraMode()).toBe(DEFAULT_ULTRA_MODE);
  });

  it("reads primary key", () => {
    localStorage.setItem(ULTRA_MODE_STORAGE_KEY, "off");
    expect(readUltraMode()).toBe("off");
  });

  it("reads legacy keys", () => {
    localStorage.setItem(ULTRA_MODE_STORAGE_KEYS[1]!, "off");
    expect(readUltraMode()).toBe("off");
  });

  it("returns default when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    try {
      expect(readUltraMode()).toBe(DEFAULT_ULTRA_MODE);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns default when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(readUltraMode()).toBe(DEFAULT_ULTRA_MODE);
    vi.restoreAllMocks();
  });
});

describe("applyUltraMode", () => {
  it("sets data-ultra attribute", () => {
    applyUltraMode("on");
    expect(document.documentElement.dataset.ultra).toBe("on");
    applyUltraMode("off");
    expect(document.documentElement.dataset.ultra).toBe("off");
  });
});

describe("writeUltraMode", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("applies mode to DOM", () => {
    writeUltraMode("off");
    expect(document.documentElement.dataset.ultra).toBe("off");
  });

  it("writes to localStorage", () => {
    writeUltraMode("on");
    expect(localStorage.getItem(ULTRA_MODE_STORAGE_KEY)).toBe("on");
  });

  it("dispatches event", () => {
    const handler = vi.fn();
    window.addEventListener(ULTRA_MODE_EVENT, handler);
    writeUltraMode("off");
    expect(handler).toHaveBeenCalled();
    window.removeEventListener(ULTRA_MODE_EVENT, handler);
  });

  it("silently ignores localStorage quota error", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => writeUltraMode("on")).not.toThrow();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatBytes,
  formatEta,
  settingsChanged,
  ACCEPTED_FORMATS,
  ACCEPTED_EXT_PATTERN,
  type Job,
} from "@/lib/hdr-job";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "test-id",
    file: new File([""], "test.png", { type: "image/png" }),
    sourceUrl: "blob:test",
    state: "queued",
    progress: 0,
    phase: "Queued",
    ...overrides,
  };
}

describe("formatBytes", () => {
  it("returns '0 KB' for undefined", () => {
    expect(formatBytes(undefined)).toBe("0 KB");
  });

  it("returns '0 KB' for zero", () => {
    expect(formatBytes(0)).toBe("0 KB");
  });

  it("formats bytes below 1 MB as KB", () => {
    expect(formatBytes(512 * 1024)).toBe("512 KB");
  });

  it("rounds KB values", () => {
    expect(formatBytes(1500)).toBe("1 KB");
  });

  it("formats bytes at or above 1 MB as MB with one decimal", () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });

  it("formats exact 1 MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});

describe("formatEta", () => {
  it("returns 'complete' for done state", () => {
    const job = makeJob({ state: "done", progress: 100 });
    expect(formatEta(job)).toBe("complete");
  });

  it("returns 'needs review' for error state", () => {
    const job = makeJob({ state: "error", progress: 100 });
    expect(formatEta(job)).toBe("needs review");
  });

  it("returns 'waiting' when not started", () => {
    const job = makeJob({ state: "processing", progress: 2 });
    expect(formatEta(job)).toBe("waiting");
  });

  it("returns 'waiting' when progress is below 5", () => {
    const job = makeJob({ state: "processing", progress: 4, startedAt: Date.now() - 1000 });
    expect(formatEta(job)).toBe("waiting");
  });

  it("returns 'under 1s' when remaining time is small", () => {
    // progress=99, elapsed=990ms → total≈1000ms, remaining≈10ms
    const job = makeJob({ state: "processing", progress: 99, startedAt: Date.now() - 990 });
    expect(formatEta(job)).toBe("under 1s");
  });

  it("returns seconds string for longer remaining time", () => {
    // progress=10, elapsed=1000ms → total=10000ms, remaining=9000ms → 9s
    const job = makeJob({ state: "processing", progress: 10, startedAt: Date.now() - 1000 });
    const eta = formatEta(job);
    expect(eta).toMatch(/^\d+s$/);
  });
});

describe("settingsChanged", () => {
  it("returns false when both are undefined", () => {
    expect(settingsChanged(undefined, undefined)).toBe(false);
  });

  it("returns false when first is undefined", () => {
    expect(settingsChanged(undefined, { boost: 0.5 })).toBe(false);
  });

  it("returns false when second is undefined", () => {
    expect(settingsChanged({ boost: 0.5 }, undefined)).toBe(false);
  });

  it("returns false when boost values match", () => {
    expect(settingsChanged({ boost: 0.5 }, { boost: 0.5 })).toBe(false);
  });

  it("returns true when boost values differ", () => {
    expect(settingsChanged({ boost: 0.5 }, { boost: 0.8 })).toBe(true);
  });
});

describe("ACCEPTED_FORMATS", () => {
  it("includes common image types", () => {
    expect(ACCEPTED_FORMATS).toContain("image/png");
    expect(ACCEPTED_FORMATS).toContain("image/jpeg");
    expect(ACCEPTED_FORMATS).toContain("image/svg+xml");
    expect(ACCEPTED_FORMATS).toContain("image/webp");
  });
});

describe("ACCEPTED_EXT_PATTERN", () => {
  it("matches .png files", () => expect(ACCEPTED_EXT_PATTERN.test("photo.png")).toBe(true));
  it("matches .jpg files", () => expect(ACCEPTED_EXT_PATTERN.test("photo.jpg")).toBe(true));
  it("matches .svg files", () => expect(ACCEPTED_EXT_PATTERN.test("icon.svg")).toBe(true));
  it("matches case-insensitively", () => expect(ACCEPTED_EXT_PATTERN.test("PHOTO.PNG")).toBe(true));
  it("rejects .txt files", () => expect(ACCEPTED_EXT_PATTERN.test("doc.txt")).toBe(false));
});

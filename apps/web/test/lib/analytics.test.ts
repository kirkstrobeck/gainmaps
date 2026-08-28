import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ANALYTICS_EVENTS,
  errorBucket,
  fileExtension,
  summarizeFile,
  summarizeFiles,
  track,
} from "@/lib/analytics";

afterEach(() => {
  delete window.gainmapsPostHog;
});

describe("analytics", () => {
  it("tracks through the window PostHog bridge", () => {
    const capture = vi.fn();
    window.gainmapsPostHog = { capture };

    track(ANALYTICS_EVENTS.converterFilesAdded, {
      file_count: 1,
      ignored: undefined,
    });

    expect(capture).toHaveBeenCalledWith("gainmaps_converter_files_added", {
      app: "gainmaps",
      file_count: 1,
    });
  });

  it("does not throw when PostHog is unavailable", () => {
    expect(() => track(ANALYTICS_EVENTS.shareAction)).not.toThrow();
  });

  it("summarizes files without names", () => {
    const file = new File(["abc"], "private-photo.HEIC", { type: "image/heic" });

    expect(fileExtension(file.name)).toBe("heic");
    expect(summarizeFile(file)).toEqual({
      file_bytes: 3,
      file_extension: "heic",
      file_type: "image/heic",
    });
    expect(summarizeFiles([file, new File(["x"], "other.png", { type: "image/png" })])).toEqual({
      file_count: 2,
      total_bytes: 4,
      extensions: "heic,png",
      mime_types: "image/heic,image/png",
    });
  });

  it("buckets errors instead of returning raw messages", () => {
    expect(errorBucket(new Error("Service worker did not start for my-file.jpg"))).toBe("service_worker");
    expect(errorBucket("Failed to decode image")).toBe("decode");
  });
});

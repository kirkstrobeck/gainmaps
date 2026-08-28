import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { download, type Job } from "@/lib/hdr-job";

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "j",
    file: new File(["x"], "a.png", { type: "image/png" }),
    sourceUrl: "blob:src",
    state: "done",
    progress: 100,
    phase: "Done",
    ...overrides,
  };
}

describe("download", () => {
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clicks an anchor when resultUrl and resultName exist", () => {
    download(job({ resultUrl: "blob:out", resultName: "out.jpg" }));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it("no-ops without a result", () => {
    download(job());
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
});

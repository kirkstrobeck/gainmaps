import { describe, it, expect, vi } from "vitest";
import type { Job } from "@/lib/hdr-job";
import {
  applyJobPatch,
  applyJobPatches,
  createJobUpdateCoalescer,
  isUrgentJobUpdate,
} from "@/lib/coalesce-job-updates";

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "a",
    file: new File(["x"], "a.png", { type: "image/png" }),
    sourceUrl: "blob:a",
    state: "processing",
    progress: 0,
    phase: "Enc",
    ...overrides,
  };
}

describe("applyJobPatch", () => {
  it("replaces the matching id and leaves others", () => {
    const a = job({ id: "a", progress: 1 });
    const b = job({ id: "b", progress: 2 });
    const next = applyJobPatch([a, b], job({ id: "a", progress: 9 }));
    expect(next[0]?.progress).toBe(9);
    expect(next[1]).toBe(b);
  });
});

describe("applyJobPatches", () => {
  it("returns the same array when the map is empty", () => {
    const jobs = [job()];
    expect(applyJobPatches(jobs, new Map())).toBe(jobs);
  });
  it("applies only matching ids", () => {
    const a = job({ id: "a", progress: 1 });
    const b = job({ id: "b", progress: 2 });
    const next = applyJobPatches([a, b], new Map([["b", job({ id: "b", progress: 8 })]]));
    expect(next[0]).toBe(a);
    expect(next[1]?.progress).toBe(8);
  });
});

describe("isUrgentJobUpdate", () => {
  it("is true for done and error", () => {
    expect(isUrgentJobUpdate(job({ state: "done" }))).toBe(true);
    expect(isUrgentJobUpdate(job({ state: "error" }))).toBe(true);
  });
  it("is false for progress", () => {
    expect(isUrgentJobUpdate(job({ state: "processing" }))).toBe(false);
  });
});

describe("createJobUpdateCoalescer", () => {
  it("coalesces progress to one flush per frame", () => {
    const frames: Array<() => void> = [];
    const published: Job[][] = [];
    const store = { jobs: [job({ id: "a" }), job({ id: "b" })] };
    const coalescer = createJobUpdateCoalescer({
      getJobs: () => store.jobs,
      setJobs: (next) => {
        store.jobs = [...next];
        published.push(store.jobs);
      },
      schedule: (cb) => {
        frames.push(cb);
        return frames.length;
      },
      cancel: vi.fn(),
    });
    coalescer.update(job({ id: "a", progress: 10 }));
    coalescer.update(job({ id: "a", progress: 20 }));
    coalescer.update(job({ id: "b", progress: 5 }));
    expect(published).toHaveLength(0);
    frames[0]!();
    expect(published).toHaveLength(1);
    expect(published[0]![0]?.progress).toBe(20);
    expect(published[0]![1]?.progress).toBe(5);
  });

  it("flushes terminal updates immediately and cancels a pending frame", () => {
    const cancel = vi.fn();
    const frames: Array<() => void> = [];
    const store = { jobs: [job({ id: "a" })] };
    const coalescer = createJobUpdateCoalescer({
      getJobs: () => store.jobs,
      setJobs: (next) => { store.jobs = [...next]; },
      schedule: (cb) => { frames.push(cb); return 7; },
      cancel,
    });
    coalescer.update(job({ id: "a", progress: 10 }));
    coalescer.update(job({ id: "a", state: "done", progress: 100 }));
    expect(cancel).toHaveBeenCalledWith(7);
    expect(store.jobs[0]?.state).toBe("done");
  });

  it("flush is a no-op when nothing is pending", () => {
    const setJobs = vi.fn();
    const coalescer = createJobUpdateCoalescer({
      getJobs: () => [],
      setJobs,
    });
    coalescer.flush();
    expect(setJobs).not.toHaveBeenCalled();
  });

  it("cancel is a no-op when no frame is scheduled", () => {
    const cancel = vi.fn();
    const coalescer = createJobUpdateCoalescer({
      getJobs: () => [],
      setJobs: vi.fn(),
      cancel,
    });
    coalescer.cancel();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("flushes an error immediately using the default scheduler", () => {
    const store = { jobs: [job({ id: "a" })] };
    const coalescer = createJobUpdateCoalescer({
      getJobs: () => store.jobs,
      setJobs: (next) => { store.jobs = [...next]; },
    });
    coalescer.update(job({ id: "a", progress: 10 }));
    coalescer.update(job({ id: "a", progress: 11 }));
    coalescer.update(job({ id: "a", state: "error" }));
    expect(store.jobs[0]?.state).toBe("error");
  });
});

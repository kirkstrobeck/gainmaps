import { describe, it, expect, vi, afterEach } from "vitest";
import type { Job } from "@/lib/hdr-job";

const runJob = vi.fn();
vi.mock("@/lib/hdr-worker", () => ({
  concurrencyLimit: () => 2,
  runServiceWorkerJob: (...args: unknown[]) => runJob(...args),
}));

import { runHdrQueue } from "@/lib/run-hdr-queue";

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "a",
    file: new File(["x"], "a.png", { type: "image/png" }),
    sourceUrl: "blob:a",
    state: "queued",
    progress: 0,
    phase: "Queued",
    settings: { boost: 0.5 },
    ...overrides,
  };
}

afterEach(() => {
  runJob.mockReset();
});

describe("runHdrQueue", () => {
  it("returns when the worker is not ready", async () => {
    await runHdrQueue({
      queueRunning: { current: false },
      inflightIds: { current: new Set() },
      jobsRef: { current: [job()] },
      workerReady: false,
      currentSettings: { boost: 0.5 },
      updateJob: vi.fn(),
    });
    expect(runJob).not.toHaveBeenCalled();
  });

  it("returns when a queue pass is already running", async () => {
    await runHdrQueue({
      queueRunning: { current: true },
      inflightIds: { current: new Set() },
      jobsRef: { current: [job()] },
      workerReady: true,
      currentSettings: { boost: 0.5 },
      updateJob: vi.fn(),
    });
    expect(runJob).not.toHaveBeenCalled();
  });

  it("breaks when nothing is queued", async () => {
    await runHdrQueue({
      queueRunning: { current: false },
      inflightIds: { current: new Set() },
      jobsRef: { current: [job({ state: "done" })] },
      workerReady: true,
      currentSettings: { boost: 0.5 },
      updateJob: vi.fn(),
    });
    expect(runJob).not.toHaveBeenCalled();
  });

  it("runs queued jobs and skips inflight ids", async () => {
    runJob.mockResolvedValue(undefined);
    const inflight = new Set<string>(["skip"]);
    await runHdrQueue({
      queueRunning: { current: false },
      inflightIds: { current: inflight },
      jobsRef: {
        current: [
          job({ id: "skip", settings: undefined }),
          job({ id: "go", settings: undefined }),
        ],
      },
      workerReady: true,
      currentSettings: { boost: 0.9 },
      updateJob: vi.fn(),
    });
    expect(runJob).toHaveBeenCalledTimes(1);
    expect(runJob.mock.calls[0]![0].id).toBe("go");
    expect(runJob.mock.calls[0]![1]).toEqual({ boost: 0.9 });
    expect(inflight.has("go")).toBe(false);
  });

  it("uses job.settings when present", async () => {
    runJob.mockResolvedValue(undefined);
    await runHdrQueue({
      queueRunning: { current: false },
      inflightIds: { current: new Set() },
      jobsRef: { current: [job({ id: "go", settings: { boost: 0.2 } })] },
      workerReady: true,
      currentSettings: { boost: 0.9 },
      updateJob: vi.fn(),
    });
    expect(runJob.mock.calls[0]![1]).toEqual({ boost: 0.2 });
  });

  it("drains a second batch after the first finishes", async () => {
    runJob.mockResolvedValue(undefined);
    await runHdrQueue({
      queueRunning: { current: false },
      inflightIds: { current: new Set() },
      jobsRef: {
        current: [
          job({ id: "a" }),
          job({ id: "b" }),
          job({ id: "c" }),
        ],
      },
      workerReady: true,
      currentSettings: { boost: 0.5 },
      updateJob: vi.fn(),
    });
    expect(runJob).toHaveBeenCalledTimes(3);
  });

  it("clears inflight ids when a job throws", async () => {
    runJob.mockRejectedValue(new Error("boom"));
    const inflight = new Set<string>();
    await expect(runHdrQueue({
      queueRunning: { current: false },
      inflightIds: { current: inflight },
      jobsRef: { current: [job({ id: "go" })] },
      workerReady: true,
      currentSettings: { boost: 0.5 },
      updateJob: vi.fn(),
    })).rejects.toThrow("boom");
    expect(inflight.has("go")).toBe(false);
  });
});

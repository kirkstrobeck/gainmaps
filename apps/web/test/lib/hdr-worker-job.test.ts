import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/svg-raster", () => ({
  isSvgFile: (file: File) => file.name.endsWith(".svg"),
  rasterizeSvgToPng: async () => {
    throw "raster-fail";
  },
}));

import { runServiceWorkerJob, WORKER_START_TIMEOUT_MS } from "@/lib/hdr-worker";
import type { Job } from "@/lib/hdr-job";

type FakePort = {
  onmessage: ((event: MessageEvent) => void) | null;
  close: ReturnType<typeof vi.fn>;
};

function installChannel(): { channels: { port1: FakePort; port2: FakePort }[] } {
  const channels: { port1: FakePort; port2: FakePort }[] = [];
  vi.stubGlobal(
    "MessageChannel",
    class {
      port1: FakePort = { onmessage: null, close: vi.fn() };
      port2: FakePort = { onmessage: null, close: vi.fn() };
      constructor() {
        channels.push(this);
      }
    },
  );
  return { channels };
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    file: new File(["x"], "a.png", { type: "image/png" }),
    sourceUrl: "blob:src",
    state: "queued",
    progress: 0,
    phase: "Queued",
    ...overrides,
  };
}

function installWorker(postMessage = vi.fn()) {
  const active = { state: "activated", postMessage };
  const registration = { update: vi.fn(), active };
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
      controller: active,
    },
  });
  return { postMessage };
}

describe("runServiceWorkerJob messages", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("applies progress then done", async () => {
    const { channels } = installChannel();
    installWorker();
    URL.createObjectURL = vi.fn(() => "blob:out");
    const onUpdate = vi.fn();
    const pending = runServiceWorkerJob(job(), { boost: 0.5 }, onUpdate);
    await Promise.resolve();
    await Promise.resolve();
    const port = channels[0]!.port1;
    port.onmessage?.({ data: { type: "progress", elapsedMs: 5, phase: "Enc", progress: 40 } } as MessageEvent);
    port.onmessage?.({
      data: {
        type: "done",
        elapsedMs: 10,
        phase: "Done",
        blob: new Blob(["x"]),
        name: "out.jpg",
        bytesIn: 1,
        bytesOut: 2,
        note: "ok",
      },
    } as MessageEvent);
    port.onmessage?.({ data: { type: "progress", elapsedMs: 11, phase: "late", progress: 90 } } as MessageEvent);
    await pending;
    expect(onUpdate.mock.calls.some((c) => c[0].state === "done")).toBe(true);
  });

  it("applies error messages", async () => {
    const { channels } = installChannel();
    installWorker();
    const onUpdate = vi.fn();
    const pending = runServiceWorkerJob(job(), { boost: 0.5 }, onUpdate);
    await Promise.resolve();
    await Promise.resolve();
    channels[0]!.port1.onmessage?.({
      data: { type: "error", elapsedMs: 3, error: "nope" },
    } as MessageEvent);
    await pending;
    expect(onUpdate.mock.calls.some((c) => c[0].state === "error")).toBe(true);
  });

  it("times out when the worker never starts", async () => {
    vi.useFakeTimers();
    installChannel();
    installWorker();
    const onUpdate = vi.fn();
    const pending = runServiceWorkerJob(job(), { boost: 0.5 }, onUpdate);
    await vi.advanceTimersByTimeAsync(WORKER_START_TIMEOUT_MS + 10);
    await pending;
    expect(onUpdate.mock.calls.some((c) => String(c[0].error ?? "").includes("Hard-refresh"))).toBe(true);
  });

  it("fails when rasterization throws a non-Error", async () => {
    installChannel();
    installWorker();
    const onUpdate = vi.fn();
    const svg = job({ file: new File(["x"], "a.svg", { type: "image/svg+xml" }) });
    await runServiceWorkerJob(svg, { boost: 0.5 }, onUpdate);
    expect(onUpdate.mock.calls.some((c) => c[0].error === "raster-fail")).toBe(true);
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/svg-raster", () => ({
  isSvgFile: (file: File) => file.name.endsWith(".svg"),
  rasterizeSvgToPng: async (file: File) => new File(["png"], file.name.replace(".svg", ".png"), { type: "image/png" }),
}));

import {
  concurrencyLimit,
  ensureProcessorRegistration,
  resolveActiveWorker,
  prepareProcessFile,
  failJob,
  runServiceWorkerJob,
} from "@/lib/hdr-worker";
import type { Job } from "@/lib/hdr-job";

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

describe("concurrencyLimit", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("clamps low core counts to 2", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 1 });
    expect(concurrencyLimit()).toBe(2);
  });

  it("clamps high core counts to 4", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 16 });
    expect(concurrencyLimit()).toBe(4);
  });

  it("defaults when hardwareConcurrency is missing", () => {
    vi.stubGlobal("navigator", {});
    expect(concurrencyLimit()).toBe(2);
  });
});

describe("ensureProcessorRegistration", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("throws when service workers are unavailable", async () => {
    vi.stubGlobal("navigator", {});
    await expect(ensureProcessorRegistration()).rejects.toThrow(/does not support service workers/);
  });

  it("registers and waits for ready", async () => {
    const registration = { update: vi.fn(), active: { state: "activated", postMessage: vi.fn() } };
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
        controller: registration.active,
      },
    });
    await expect(ensureProcessorRegistration()).resolves.toBe(registration);
  });
});

describe("resolveActiveWorker", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("throws when no worker is active", async () => {
    const registration = { update: vi.fn(), active: null };
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
        controller: null,
      },
    });
    await expect(resolveActiveWorker()).rejects.toThrow(/not active/);
  });

  it("throws when the worker is redundant", async () => {
    const registration = { update: vi.fn(), active: { state: "redundant" } };
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
        controller: null,
      },
    });
    await expect(resolveActiveWorker()).rejects.toThrow(/not active/);
  });
});

describe("prepareProcessFile", () => {
  it("returns the original file for rasters", async () => {
    const file = new File(["x"], "a.png", { type: "image/png" });
    expect(await prepareProcessFile(file)).toBe(file);
  });

  it("rasterizes SVGs", async () => {
    const file = new File(["<svg/>"], "a.svg", { type: "image/svg+xml" });
    const out = await prepareProcessFile(file);
    expect(out.name).toBe("a.png");
  });
});

describe("failJob", () => {
  it("reports a failed update", () => {
    const onUpdate = vi.fn();
    failJob(job(), { boost: 0.5 }, Date.now() - 10, "boom", onUpdate);
    expect(onUpdate.mock.calls[0]![0].state).toBe("error");
    expect(onUpdate.mock.calls[0]![0].error).toBe("boom");
  });
});

describe("runServiceWorkerJob non-Error catch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("covers String(error) branch when rejection is not an Error", async () => {
    const readyReject = Promise.reject("a plain string error");
    readyReject.catch(() => {}); // suppress unhandled rejection
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: vi.fn().mockRejectedValue("a plain string error"),
        ready: readyReject,
        controller: null,
      },
    });
    const onUpdate = vi.fn();
    await runServiceWorkerJob(job(), { boost: 0.5 }, onUpdate);
    const calls = onUpdate.mock.calls;
    const call = calls[calls.length - 1]![0];
    expect(call.state).toBe("error");
    expect(call.error).toBe("a plain string error");
  });
});

describe("runServiceWorkerJob Error catch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("covers error.message branch when rejection is an Error instance", async () => {
    const registerError = new Error("service worker failed");
    const readyPromise = Promise.reject(registerError);
    readyPromise.catch(() => {}); // suppress unhandled rejection
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: vi.fn().mockRejectedValue(registerError),
        ready: readyPromise,
        controller: null,
      },
    });
    const onUpdate = vi.fn();
    await runServiceWorkerJob(job(), { boost: 0.5 }, onUpdate);
    const calls = onUpdate.mock.calls;
    const call = calls[calls.length - 1]![0];
    expect(call.state).toBe("error");
    expect(call.error).toBe("service worker failed");
  });
});

describe("runServiceWorkerJob start", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts PROCESS_IMAGE once the worker is ready", async () => {
    const postMessage = vi.fn();
    const registration = { update: vi.fn(), active: { state: "activated", postMessage } };
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
        controller: registration.active,
      },
    });
    vi.stubGlobal(
      "MessageChannel",
      class {
        port1 = { onmessage: null, close: vi.fn() };
        port2 = { close: vi.fn() };
      },
    );
    const onUpdate = vi.fn();
    const pending = runServiceWorkerJob(job(), { boost: 0.5 }, onUpdate);
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());
    expect(onUpdate.mock.calls[0]![0].state).toBe("processing");
    await Promise.race([pending, Promise.resolve()]);
  });
});

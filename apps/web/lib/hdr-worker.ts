import { isSvgFile, rasterizeSvgToPng } from "@/lib/svg-raster";
import { ANALYTICS_EVENTS, errorBucket, summarizeFile, track } from "@/lib/analytics";
import { headroomFromBoost } from "@/lib/gain-map-encode";
import { type Job, type JobSettings } from "@/lib/hdr-job";

export function concurrencyLimit(): number {
  const cores = navigator.hardwareConcurrency || 4;
  return Math.min(Math.max(Math.floor(cores / 2), 2), 4);
}

export const WORKER_START_TIMEOUT_MS = 12_000;

export async function ensureProcessorRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }
  const registration = await navigator.serviceWorker.register("/hdr-service-worker.js", {
    scope: "/",
    updateViaCache: "none",
  });
  void registration.update();
  await navigator.serviceWorker.ready;
  return registration;
}

export async function resolveActiveWorker(): Promise<ServiceWorker> {
  const registration = await ensureProcessorRegistration();
  const worker = registration.active ?? navigator.serviceWorker.controller;
  if (!worker || worker.state === "redundant") {
    throw new Error("Service worker is not active yet.");
  }
  return worker;
}

export async function prepareProcessFile(file: File): Promise<File> {
  if (!isSvgFile(file)) return file;
  return rasterizeSvgToPng(file);
}

export function failJob(
  job: Job,
  options: JobSettings,
  startedAt: number,
  error: string,
  onUpdate: (job: Job) => void,
): void {
  track(ANALYTICS_EVENTS.converterWorkerJobFailed, {
    ...summarizeFile(job.file),
    boost: options.boost,
    headroom: headroomFromBoost(options.boost),
    elapsed_ms: Date.now() - startedAt,
    error_bucket: errorBucket(error),
    failure_source: "fail_job",
  });
  onUpdate({
    ...job,
    state: "error",
    settings: options,
    startedAt,
    elapsedMs: Date.now() - startedAt,
    phase: "Failed",
    progress: 100,
    error,
  });
}

export function runServiceWorkerJob(
  job: Job,
  options: JobSettings,
  onUpdate: (job: Job) => void,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    const startedAt = Date.now();
    const gate = { open: true };

    function finish() {
      /* v8 ignore next */
      if (!gate.open) return;
      gate.open = false;
      clearTimeout(startTimer);
      channel.port1.close();
      resolve();
    }

    track(ANALYTICS_EVENTS.converterWorkerJobStarted, {
      ...summarizeFile(job.file),
      boost: options.boost,
      headroom: headroomFromBoost(options.boost),
      input_was_svg: isSvgFile(job.file),
    });

    onUpdate({
      ...job,
      state: "processing",
      settings: options,
      startedAt,
      phase: isSvgFile(job.file) ? "Rasterizing SVG" : "Starting",
      progress: 1,
      error: undefined,
      note: undefined,
    });

    const startTimer = setTimeout(() => {
      failJob(
        job,
        options,
        startedAt,
        "Worker did not start. Hard-refresh the page to reload the processor.",
        onUpdate,
      );
      finish();
    }, WORKER_START_TIMEOUT_MS);

    channel.port1.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (!gate.open) return;
      if (message.type === "progress") {
        clearTimeout(startTimer);
        onUpdate({
          ...job,
          state: "processing",
          settings: options,
          startedAt,
          elapsedMs: message.elapsedMs,
          phase: message.phase,
          progress: message.progress,
        });
      }
      if (message.type === "done") {
        clearTimeout(startTimer);
        const result = message.blob as Blob;
        const resultUrl = URL.createObjectURL(result);
        track(ANALYTICS_EVENTS.converterWorkerJobCompleted, {
          ...summarizeFile(job.file),
          boost: options.boost,
          headroom: headroomFromBoost(options.boost),
          elapsed_ms: message.elapsedMs,
          bytes_in: message.bytesIn,
          bytes_out: message.bytesOut,
          has_note: Boolean(message.note),
        });
        onUpdate({
          ...job,
          state: "done",
          settings: options,
          startedAt,
          elapsedMs: message.elapsedMs,
          phase: message.phase,
          progress: 100,
          result,
          resultUrl,
          resultName: message.name,
          bytesIn: message.bytesIn,
          bytesOut: message.bytesOut,
          note: message.note,
        });
        finish();
      }
      if (message.type === "error") {
        clearTimeout(startTimer);
        track(ANALYTICS_EVENTS.converterWorkerJobFailed, {
          ...summarizeFile(job.file),
          boost: options.boost,
          headroom: headroomFromBoost(options.boost),
          elapsed_ms: message.elapsedMs,
          error_bucket: errorBucket(message.error),
        });
        onUpdate({
          ...job,
          state: "error",
          settings: options,
          startedAt,
          elapsedMs: message.elapsedMs,
          phase: "Failed",
          progress: 100,
          error: message.error,
        });
        finish();
      }
    };

    void prepareProcessFile(job.file)
      .then(async (file) => {
        const worker = await resolveActiveWorker();
        if (!gate.open) return;
        worker.postMessage(
          { type: "PROCESS_IMAGE", id: job.id, file, options },
          [channel.port2],
        );
      })
      .catch((error: unknown) => {
        failJob(
          job,
          options,
          startedAt,
          error instanceof Error ? error.message : String(error),
          onUpdate,
        );
        finish();
      });
  });
}

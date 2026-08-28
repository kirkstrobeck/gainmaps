import type { Job, JobSettings } from "@/lib/hdr-job";
import { concurrencyLimit, runServiceWorkerJob } from "@/lib/hdr-worker";

export async function runHdrQueue(options: {
  queueRunning: { current: boolean };
  inflightIds: { current: Set<string> };
  jobsRef: { current: readonly Job[] };
  workerReady: boolean;
  currentSettings: JobSettings;
  updateJob: (job: Job) => void;
}): Promise<void> {
  if (options.queueRunning.current || !options.workerReady) return;
  options.queueRunning.current = true;
  try {
    const dispatchedIds = new Set<string>();
    while (true) {
      const queued = options.jobsRef.current.filter(
        (job) => job.state === "queued" && !options.inflightIds.current.has(job.id) && !dispatchedIds.has(job.id),
      );
      if (queued.length === 0) break;
      const batch = queued.slice(0, concurrencyLimit());
      for (const job of batch) {
        options.inflightIds.current.add(job.id);
        dispatchedIds.add(job.id);
      }
      try {
        await Promise.all(
          batch.map((job) => {
            /* v8 ignore next */
            return runServiceWorkerJob(job, job.settings ?? options.currentSettings, options.updateJob);
          }),
        );
      } finally {
        for (const job of batch) options.inflightIds.current.delete(job.id);
      }
    }
  } finally {
    options.queueRunning.current = false;
  }
}

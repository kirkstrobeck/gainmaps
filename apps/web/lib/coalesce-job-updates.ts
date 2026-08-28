import type { Job } from "@/lib/hdr-job";

export function applyJobPatch(jobs: readonly Job[], patch: Job): readonly Job[] {
  return jobs.map((job) => (job.id === patch.id ? { ...job, ...patch } : job));
}

export function applyJobPatches(
  jobs: readonly Job[],
  patches: ReadonlyMap<string, Job>,
): readonly Job[] {
  if (patches.size === 0) return jobs;
  return jobs.map((job) => {
    const patch = patches.get(job.id);
    if (!patch) return job;
    return { ...job, ...patch };
  });
}

export function isUrgentJobUpdate(job: Job): boolean {
  return job.state === "done" || job.state === "error";
}

type Scheduler = (callback: () => void) => number;
type Canceller = (id: number) => void;

export function createJobUpdateCoalescer(options: {
  getJobs: () => readonly Job[];
  setJobs: (jobs: readonly Job[]) => void;
  schedule?: Scheduler;
  cancel?: Canceller;
}): {
  update: (next: Job) => void;
  flush: () => void;
  cancel: () => void;
} {
  const pending = new Map<string, Job>();
  const scheduled = { id: 0 };
  const schedule = options.schedule ?? ((cb) => requestAnimationFrame(cb));
  const cancelFrame = options.cancel ?? ((id) => cancelAnimationFrame(id));

  function flush(): void {
    scheduled.id = 0;
    if (pending.size === 0) return;
    const patches = new Map(pending);
    pending.clear();
    options.setJobs(applyJobPatches(options.getJobs(), patches));
  }

  function cancel(): void {
    if (!scheduled.id) return;
    cancelFrame(scheduled.id);
    scheduled.id = 0;
  }

  function update(next: Job): void {
    pending.set(next.id, next);
    if (isUrgentJobUpdate(next)) {
      cancel();
      flush();
      return;
    }
    if (scheduled.id) return;
    scheduled.id = schedule(flush);
  }

  return { update, flush, cancel };
}

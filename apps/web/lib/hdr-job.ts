export type JobState = "queued" | "processing" | "done" | "error";

export interface JobSettings {
  boost: number;
}

export interface Job {
  id: string;
  file: File;
  sourceUrl: string;
  state: JobState;
  progress: number;
  phase: string;
  settings?: JobSettings;
  startedAt?: number;
  elapsedMs?: number;
  result?: Blob;
  resultName?: string;
  resultUrl?: string;
  bytesIn?: number;
  bytesOut?: number;
  note?: string;
  error?: string;
}

export const ACCEPTED_FORMATS = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/svg+xml",
];

export const ACCEPTED_EXT_PATTERN = /\.(png|jpe?g|webp|avif|gif|heic|heif|svg)$/i;

export function formatBytes(bytes?: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatEta(job: Job): string {
  if (job.state === "done") return "complete";
  if (job.state === "error") return "needs review";
  if (!job.startedAt || job.progress < 5) return "waiting";
  const elapsed = Date.now() - job.startedAt;
  const total = elapsed / Math.max(job.progress / 100, 0.05);
  const remaining = Math.max(total - elapsed, 0);
  if (remaining < 1000) return "under 1s";
  return `${Math.ceil(remaining / 1000)}s`;
}

export function settingsChanged(a?: JobSettings, b?: JobSettings): boolean {
  if (!a || !b) return false;
  return a.boost !== b.boost;
}

export function download(job: Job): void {
  if (!job.resultUrl || !job.resultName) return;
  const anchor = document.createElement("a");
  anchor.href = job.resultUrl;
  anchor.download = job.resultName;
  anchor.click();
}

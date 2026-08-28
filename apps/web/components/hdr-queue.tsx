"use client";

import {
  ArrowDownwardIcon as ArrowDownFilled,
  CheckIcon as CheckFilled,
  DescriptionIcon as FileFilled,
  UploadFileIcon as FileUploadFilled,
  RefreshIcon as Refresh1Filled,
  CloseIcon as CloseFilled,
} from "@/components/icons";
import type { DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UltraWord } from "@/components/ultra-word";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";
import { headroomFromBoost } from "@/lib/gain-map-encode";
import { type Job, formatBytes, formatEta } from "@/lib/hdr-job";
import { cn } from "@/lib/utils";

interface HdrQueueProps {
  jobs: Job[];
  selectedJob: Job | null;
  onSelectJob: (job: Job) => void;
  onDownloadJob: (job: Job) => void;
  clearJobs: () => void;
  dragActive: boolean;
  addFiles: (files: FileList | File[]) => void;
}

export function HdrQueue({
  jobs,
  selectedJob,
  onSelectJob,
  onDownloadJob,
  clearJobs,
  dragActive,
  addFiles,
}: HdrQueueProps) {
  return (
    <div className="ultra-surface order-2 flex min-h-0 max-h-[40dvh] flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] shadow-sm lg:order-none lg:max-h-none">
      <div className="grid shrink-0 gap-3 border-b border-[var(--border)] p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-normal text-[var(--foreground)]">
              <UltraWord text="Queue" typeClassName="text-lg font-semibold tracking-normal" intensity={TEXT_ULTRA_INTENSITY} />
            </h1>
            <p className="mt-1 truncate text-sm text-[var(--muted)]">Select a row to inspect or re-encode.</p>
          </div>
          <Button variant="secondary" className="h-9 px-3" onClick={clearJobs} aria-label="Clear queue">
            <Refresh1Filled aria-hidden size={18} />
          </Button>
        </div>
        <label
          className={cn(
            "grid cursor-pointer place-items-center gap-2 rounded-[var(--radius)] border border-dashed border-[color-mix(in_srgb,var(--foreground)_24%,var(--border))] bg-[var(--background)] px-3 py-4 text-center transition",
            dragActive && "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--background))]",
          )}
        >
          <FileUploadFilled aria-hidden size={22} />
          <span className="text-sm font-medium">Drop more images here</span>
          <span className="text-xs text-[var(--muted)]">PNG, JPEG, WebP, AVIF, GIF, HEIC, SVG</span>
          <input
            className="sr-only"
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.avif,.gif,.heic,.heif,.svg,image/*"
            multiple
            onChange={(event) => event.currentTarget.files && addFiles(event.currentTarget.files)}
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-auto">
        {jobs.map((job) => (
          <article
            key={job.id}
            data-testid="job-row"
            role="button"
            tabIndex={0}
            onClick={() => onSelectJob(job)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSelectJob(job);
            }}
            className={cn(
              "grid cursor-pointer gap-3 p-3 outline-none transition hover:bg-[var(--panel-strong)] focus:bg-[var(--panel-strong)]",
              selectedJob?.id === job.id && "bg-[var(--panel-strong)]",
            )}
          >
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)]">
                  {job.state === "done" ? (
                    <CheckFilled aria-hidden size={18} />
                  ) : job.state === "error" ? (
                    <CloseFilled aria-hidden size={18} />
                  ) : (
                    <FileFilled aria-hidden size={18} />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium">{job.file.name}</h3>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">
                    {job.phase} / {formatBytes(job.file.size)} / ETA {formatEta(job)}
                  </p>
                  {job.settings ? (
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      Gain {headroomFromBoost(job.settings.boost).toFixed(2)}
                    </p>
                  ) : null}
                </div>
              </div>
              <Progress value={job.progress} className="mt-3" />
              {job.note ? <p className="mt-2 text-xs text-[var(--muted)]">{job.note}</p> : null}
              {job.error ? <p className="mt-2 text-xs text-[var(--danger)]">{job.error}</p> : null}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-[var(--muted)]">
                {job.state === "done" ? formatBytes(job.bytesOut) : `${Math.round(job.progress)}%`}
              </span>
              <Button
                variant="secondary"
                className="h-8 px-3"
                disabled={job.state !== "done"}
                onClick={(event) => {
                  event.stopPropagation();
                  onDownloadJob(job);
                }}
              >
                <ArrowDownFilled aria-hidden size={17} />
                Download
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

"use client";

import {
  CloseIcon as CloseFilled,
  AutoAwesomeIcon as SparklesFilled,
  LockIcon as LockFilled,
  ScheduleIcon as ClockFilled,
} from "@/components/icons";

import { Progress } from "@/components/ui/progress";
import { SvgPreview } from "@/components/svg-preview";
import { headroomFromBoost } from "@/lib/gain-map-encode";
import { type Job } from "@/lib/hdr-job";
import { isSvgFile } from "@/lib/svg-raster";

interface HdrDetailProps {
  selectedJob: Job | null;
  boost: number;
  selectedNeedsRegeneration: boolean;
}

export function HdrDetail({ selectedJob, boost, selectedNeedsRegeneration }: HdrDetailProps) {
  return (
    <div className="ultra-surface order-1 flex min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] shadow-sm lg:order-none">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-3 sm:p-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-normal">
            {selectedJob?.file.name ?? "Preview"}
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {selectedJob?.settings
              ? `Processed with gain ${headroomFromBoost(selectedJob.settings.boost).toFixed(2)}`
              : `Ready with gain ${headroomFromBoost(boost).toFixed(2)}`}
          </p>
        </div>
        <div className="text-right text-xs text-[var(--muted)]">
          <div className="font-medium text-[var(--foreground)]">
            {selectedNeedsRegeneration ? "Re-encode to apply" : "Settings matched"}
          </div>
          <div>Standard · Ultra preview</div>
        </div>
      </div>

      <div className="grid place-items-center p-4 lg:min-h-0 lg:flex-1 lg:overflow-auto">
        <div className="grid w-full max-w-full grid-cols-2 items-start gap-3 sm:gap-4 md:grid-cols-[minmax(0,300px)_auto_minmax(0,300px)] md:items-center md:justify-center">
          <figure className="grid min-w-0 gap-2">
            <figcaption className="text-center text-sm font-medium">Original</figcaption>
            <p className="text-center text-[11px] text-[var(--muted)]">SDR reference</p>
            <div className="grid aspect-square w-full max-w-[300px] place-items-center justify-self-center overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-3 shadow-sm">
              {selectedJob && isSvgFile(selectedJob.file) ? (
                <SvgPreview file={selectedJob.file} className="preview-original" />
              ) : selectedJob ? (
                <img
                  alt={`Original ${selectedJob.file.name}`}
                  src={selectedJob.sourceUrl}
                  className="preview-original max-h-full max-w-full object-contain"
                />
              ) : null}
            </div>
          </figure>

          <div className="hidden h-px w-12 bg-[var(--border)] md:block" />

          <figure className="grid min-w-0 gap-2">
            <figcaption className="text-center text-sm font-medium">Revised</figcaption>
            <p className="text-center text-[11px] text-[var(--muted)]" data-testid="ultra-preview-state">
              Ultra HDR
            </p>
            <div className="grid aspect-square w-full max-w-[300px] place-items-center justify-self-center overflow-hidden rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--foreground)_18%,var(--border))] bg-[var(--background)] p-3 shadow-sm">
              {selectedJob?.resultUrl ? (
                <img
                  alt={`Revised ${selectedJob.file.name}`}
                  src={selectedJob.resultUrl}
                  className="preview-revised gainmap-image max-h-full max-w-full object-contain"
                />
              ) : selectedJob ? (
                <div className={`grid w-full max-w-[220px] gap-3 text-center text-sm ${selectedJob.state === "error" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                  {selectedJob.state === "error" ? (
                    <CloseFilled aria-hidden className="mx-auto" size={28} />
                  ) : (
                    <SparklesFilled aria-hidden className="mx-auto" size={28} />
                  )}
                  <p>{selectedJob.state === "error" ? selectedJob.error : selectedJob.phase}</p>
                  <Progress value={selectedJob.progress} />
                </div>
              ) : null}
            </div>
          </figure>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] p-3 text-xs text-[var(--muted)] sm:p-4">
        <span className="flex items-center gap-2">
          <LockFilled aria-hidden size={15} />
          100% in your browser via service worker.
        </span>
        <span className="flex items-center gap-2">
          <ClockFilled aria-hidden size={15} />
          Parallel jobs scale to your CPU.
        </span>
      </div>
    </div>
  );
}

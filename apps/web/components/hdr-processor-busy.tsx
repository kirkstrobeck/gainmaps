"use client";

import type { DragEvent } from "react";
import { HdrControlsBar } from "@/components/hdr-controls-bar";
import { HdrQueue } from "@/components/hdr-queue";
import { HdrDetail } from "@/components/hdr-detail";
import { type Job } from "@/lib/hdr-job";
import { cn } from "@/lib/utils";

export function HdrProcessorBusy({
  dropHandlers,
  dragActive,
  boost,
  setBoost,
  autoDownload,
  setAutoDownload,
  workerState,
  totals,
  selectedJob,
  selectedNeedsRegeneration,
  redoSelected,
  selectJob,
  clearJobs,
  addFiles,
  downloadJob,
  jobs,
}: {
  dropHandlers: {
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
  dragActive: boolean;
  boost: number;
  setBoost: (value: number) => void;
  autoDownload: boolean;
  setAutoDownload: (value: boolean) => void;
  workerState: "checking" | "ready" | "error";
  totals: { done: number; running: number; failed: number; total: number };
  selectedJob: Job | null;
  selectedNeedsRegeneration: boolean;
  redoSelected: () => void;
  selectJob: (job: Job) => void;
  clearJobs: () => void;
  addFiles: (files: FileList | File[], source?: string) => void;
  downloadJob: (job: Job, source: string) => void;
  jobs: Job[];
}) {
  return (
    <section
      {...dropHandlers}
      className={cn(
        "grid h-[calc(100dvh-4rem)] min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8",
        dragActive && "bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]",
      )}
    >
      <HdrControlsBar
        boost={boost}
        setBoost={setBoost}
        autoDownload={autoDownload}
        setAutoDownload={setAutoDownload}
        workerState={workerState}
        totals={totals}
        selectedJob={selectedJob}
        selectedNeedsRegeneration={selectedNeedsRegeneration}
        redoSelected={redoSelected}
        onDownload={() => selectedJob && downloadJob(selectedJob, "selected_button")}
      />
      <div className="grid min-h-0 gap-4 overflow-y-auto lg:grid-cols-[minmax(18rem,23rem)_minmax(0,1fr)] lg:overflow-hidden">
        <HdrQueue
          jobs={jobs}
          selectedJob={selectedJob}
          onSelectJob={selectJob}
          onDownloadJob={(job) => downloadJob(job, "queue_row")}
          clearJobs={clearJobs}
          dragActive={dragActive}
          addFiles={addFiles}
        />
        <HdrDetail
          selectedJob={selectedJob}
          boost={boost}
          selectedNeedsRegeneration={selectedNeedsRegeneration}
        />
      </div>
    </section>
  );
}

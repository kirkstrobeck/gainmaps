"use client";

import {
  ArrowDownwardIcon as ArrowDownFilled,
  RefreshIcon as Refresh1Filled,
  VerifiedUserIcon as SafeShieldFilled,
  ScheduleIcon as ClockFilled,
} from "@/components/icons";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { headroomFromBoost } from "@/lib/gain-map-encode";
import type { Job } from "@/lib/hdr-job";

interface Totals {
  done: number;
  running: number;
  failed: number;
  total: number;
}

interface HdrControlsBarProps {
  boost: number;
  setBoost: (v: number) => void;
  autoDownload: boolean;
  setAutoDownload: (v: boolean) => void;
  workerState: "checking" | "ready" | "error";
  totals: Totals;
  selectedJob: Job | null;
  selectedNeedsRegeneration: boolean;
  redoSelected: () => void;
  onDownload: () => void;
}

export function HdrControlsBar({
  boost,
  setBoost,
  autoDownload,
  setAutoDownload,
  workerState,
  totals,
  selectedJob,
  selectedNeedsRegeneration,
  redoSelected,
  onDownload,
}: HdrControlsBarProps) {
  return (
    <div className="ultra-surface min-h-0 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-3 shadow-sm sm:p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_auto] lg:items-end">
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="boost">Gain</Label>
            <span className="font-mono text-sm tabular-nums">{headroomFromBoost(boost).toFixed(2)}×</span>
          </div>
          <input
            id="boost"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={boost}
            onChange={(event) => setBoost(Number(event.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 lg:justify-start">
          {selectedNeedsRegeneration ? (
            <Button
              className="h-10 px-4"
              disabled={!selectedJob || selectedJob.state === "processing"}
              onClick={redoSelected}
            >
              <Refresh1Filled aria-hidden size={18} />
              Regenerate
            </Button>
          ) : null}
          <Button
            className="h-10 px-4"
            disabled={selectedJob?.state !== "done"}
            onClick={onDownload}
          >
            <ArrowDownFilled aria-hidden size={17} />
            Download
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
            <SafeShieldFilled aria-hidden size={15} />
            In-browser service worker
          </span>
          {workerState !== "ready" && (
            <span className={workerState === "error" ? "text-[var(--danger)]" : ""}>
              Worker {workerState}
            </span>
          )}
          {totals.running > 0 && <span>Encoding {totals.running}</span>}
          <span>{totals.done}/{totals.total} done</span>
          {totals.failed > 0 && <span className="text-[var(--danger)]">Failed {totals.failed}</span>}
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="accent-[var(--foreground)]"
            checked={autoDownload}
            onChange={(event) => setAutoDownload(event.target.checked)}
          />
          Automatically download completed files
        </label>
      </div>
    </div>
  );
}

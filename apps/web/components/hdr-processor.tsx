"use client";

import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { HdrEmpty } from "@/components/hdr-empty";
import { HdrProcessorBusy } from "@/components/hdr-processor-busy";
import {
  type Job,
  ACCEPTED_FORMATS,
  ACCEPTED_EXT_PATTERN,
  settingsChanged,
  download,
} from "@/lib/hdr-job";
import { createJobUpdateCoalescer } from "@/lib/coalesce-job-updates";
import { ensureProcessorRegistration } from "@/lib/hdr-worker";
import { dequeueFiles } from "@/lib/file-queue";
import { runHdrQueue } from "@/lib/run-hdr-queue";
import { ANALYTICS_EVENTS, errorBucket, summarizeFiles, summarizeFile, track } from "@/lib/analytics";
import { headroomFromBoost } from "@/lib/gain-map-encode";

export function HdrProcessor() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [boost, setBoost] = useState(0.5);
  const [autoDownload, setAutoDownload] = useState(false);
  const [workerState, setWorkerState] = useState<"checking" | "ready" | "error">("checking");
  const [dragActive, setDragActive] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const queueRunning = useRef(false);
  const inflightIds = useRef(new Set<string>());
  const downloaded = useRef(new Set<string>());
  const jobsRef = useRef(jobs);

  const coalescer = useMemo(() => createJobUpdateCoalescer({
    getJobs: () => jobsRef.current,
    setJobs: (next) => {
      const copy = [...next];
      jobsRef.current = copy;
      setJobs(copy);
    },
  }), []);
  const updateJob = coalescer.update;
  const currentSettings = useMemo(() => ({ boost }), [boost]);

  const processQueue = useCallback(async () => {
    await runHdrQueue({
      queueRunning, inflightIds, jobsRef,
      workerReady: workerState === "ready",
      currentSettings, updateJob,
    });
  }, [currentSettings, updateJob, workerState]);

  const downloadJob = useCallback((job: Job, source: string) => {
    track(ANALYTICS_EVENTS.converterDownloadStarted, {
      ...summarizeFile(job.file),
      download_source: source,
      bytes_out: job.bytesOut,
      elapsed_ms: job.elapsedMs,
      auto_download_enabled: autoDownload,
    });
    download(job);
  }, [autoDownload]);

  useEffect(() => {
    jobsRef.current = jobs;
    if (!autoDownload) return;
    for (const job of jobs) {
      if (job.state === "done" && job.resultUrl && !downloaded.current.has(job.id)) {
        downloaded.current.add(job.id);
        downloadJob(job, "auto_download");
      }
    }
  }, [autoDownload, downloadJob, jobs]);

  useEffect(() => {
    const gate = { open: true };
    ensureProcessorRegistration()
      .then(() => {
        /* v8 ignore next */
        if (gate.open) {
          setWorkerState("ready");
          track(ANALYTICS_EVENTS.converterWorkerReady, { worker_type: "service_worker" });
        }
      })
      .catch((error: unknown) => {
        /* v8 ignore next */
        if (gate.open) {
          setWorkerState("error");
          track(ANALYTICS_EVENTS.converterWorkerError, {
            worker_type: "service_worker",
            error_bucket: errorBucket(error),
          });
        }
      });
    return () => { gate.open = false; };
  }, []);

  useEffect(() => () => {
    coalescer.cancel();
    for (const job of jobsRef.current) {
      URL.revokeObjectURL(job.sourceUrl);
      if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
    }
  }, [coalescer]);

  useEffect(() => { if (workerState === "ready") void processQueue(); }, [jobs, processQueue, workerState]);

  const addFiles = useCallback((files: FileList | File[], source = "converter_unknown") => {
    const allFiles = Array.from(files);
    const accepted = allFiles.filter((file) =>
      ACCEPTED_FORMATS.includes(file.type) || ACCEPTED_EXT_PATTERN.test(file.name),
    );
    const rejected = allFiles.filter((file) => !accepted.includes(file));
    if (accepted.length > 0) {
      track(ANALYTICS_EVENTS.converterFilesAdded, {
        ...summarizeFiles(accepted),
        rejected_count: rejected.length,
        source,
        boost: currentSettings.boost,
        headroom: headroomFromBoost(currentSettings.boost),
        worker_state: workerState,
      });
    }
    if (rejected.length > 0) {
      track(ANALYTICS_EVENTS.converterFilesRejected, {
        ...summarizeFiles(rejected),
        source,
        worker_state: workerState,
      });
    }
    const next = accepted
      .map<Job>((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file, sourceUrl: URL.createObjectURL(file),
        state: "queued", progress: 0, phase: "Queued", settings: currentSettings,
      }));
    if (next[0]) setSelectedJobId(next[0].id);
    setJobs((current) => [...next, ...current]);
  }, [currentSettings, workerState]);

  useEffect(() => {
    const files = dequeueFiles();
    if (files.length > 0) addFiles(files, "home_handoff");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearJobs = useCallback(() => {
    track(ANALYTICS_EVENTS.converterQueueCleared, {
      total_jobs: jobsRef.current.length,
      completed_jobs: jobsRef.current.filter((job) => job.state === "done").length,
      failed_jobs: jobsRef.current.filter((job) => job.state === "error").length,
    });
    for (const job of jobsRef.current) {
      URL.revokeObjectURL(job.sourceUrl);
      /* v8 ignore next */
      if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
    }
    downloaded.current.clear();
    setJobs([]);
    setSelectedJobId(null);
  }, []);

  const redoSelected = useCallback(() => {
    const selected = jobsRef.current.find((job) => job.id === selectedJobId);
    /* v8 ignore next */
    if (!selected) return;
    track(ANALYTICS_EVENTS.converterRedoRequested, {
      ...summarizeFile(selected.file),
      boost: currentSettings.boost,
      headroom: headroomFromBoost(currentSettings.boost),
      previous_state: selected.state,
    });
    const nextSelectedId = `${selected.file.name}-${selected.file.size}-${selected.file.lastModified}-${crypto.randomUUID()}`;
    setJobs((current) => current.map((job) => {
      /* v8 ignore next */
      if (job.id !== selectedJobId) return job;
      if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
      downloaded.current.delete(job.id);
      return {
        id: nextSelectedId, file: job.file, sourceUrl: job.sourceUrl,
        state: "queued", progress: 0, phase: "Queued", settings: currentSettings,
      };
    }));
    setSelectedJobId(nextSelectedId);
  }, [currentSettings, selectedJobId]);

  const totals = useMemo(() => ({
    done: jobs.filter((job) => job.state === "done").length,
    running: jobs.filter((job) => job.state === "processing").length,
    failed: jobs.filter((job) => job.state === "error").length,
    total: jobs.length,
  }), [jobs]);
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId],
  );
  const selectedNeedsRegeneration = settingsChanged(selectedJob?.settings, currentSettings);

  useEffect(() => {
    /* v8 ignore next */
    if (!jobs.length && selectedJobId) setSelectedJobId(null);
    /* v8 ignore next */
    if (jobs.length && !selectedJob) setSelectedJobId(jobs[0]!.id);
  }, [jobs, selectedJob, selectedJobId]);

  const setBoostTracked = useCallback((value: number) => {
    setBoost(value);
    track(ANALYTICS_EVENTS.converterGainChanged, {
      boost: value,
      headroom: headroomFromBoost(value),
    });
  }, []);

  const setAutoDownloadTracked = useCallback((value: boolean) => {
    setAutoDownload(value);
    track(ANALYTICS_EVENTS.converterAutoDownloadChanged, { enabled: value });
  }, []);

  const selectJob = useCallback((job: Job) => {
    setSelectedJobId(job.id);
    if (!job.settings) return;
    setBoost(job.settings.boost);
  }, []);

  const dropHandlers = {
    onDragOver: (event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragActive(true); },
    onDragLeave: () => setDragActive(false),
    onDrop: (event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragActive(false); addFiles(event.dataTransfer.files, jobsRef.current.length > 0 ? "converter_busy_drop" : "converter_empty_drop"); },
  };

  if (jobs.length === 0) {
    return <HdrEmpty addFiles={addFiles} dragActive={dragActive} dropHandlers={dropHandlers} />;
  }

  return (
    <HdrProcessorBusy
      dropHandlers={dropHandlers} dragActive={dragActive}
      boost={boost} setBoost={setBoostTracked}
      autoDownload={autoDownload} setAutoDownload={setAutoDownloadTracked}
      workerState={workerState} totals={totals}
      selectedJob={selectedJob} selectedNeedsRegeneration={selectedNeedsRegeneration}
      redoSelected={redoSelected} selectJob={selectJob}
      clearJobs={clearJobs} addFiles={addFiles} downloadJob={downloadJob} jobs={jobs}
    />
  );
}

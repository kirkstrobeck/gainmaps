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

  useEffect(() => {
    jobsRef.current = jobs;
    if (!autoDownload) return;
    for (const job of jobs) {
      if (job.state === "done" && job.resultUrl && !downloaded.current.has(job.id)) {
        downloaded.current.add(job.id);
        download(job);
      }
    }
  }, [autoDownload, jobs]);

  useEffect(() => {
    const gate = { open: true };
    ensureProcessorRegistration()
      .then(() => { /* v8 ignore next */ if (gate.open) setWorkerState("ready"); })
      .catch(() => { /* v8 ignore next */ if (gate.open) setWorkerState("error"); });
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

  const addFiles = useCallback((files: FileList | File[]) => {
    const next = Array.from(files)
      .filter((file) => ACCEPTED_FORMATS.includes(file.type) || ACCEPTED_EXT_PATTERN.test(file.name))
      .map<Job>((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file, sourceUrl: URL.createObjectURL(file),
        state: "queued", progress: 0, phase: "Queued", settings: currentSettings,
      }));
    if (next[0]) setSelectedJobId(next[0].id);
    setJobs((current) => [...next, ...current]);
  }, [currentSettings]);

  useEffect(() => {
    const files = dequeueFiles();
    if (files.length > 0) addFiles(files);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearJobs = useCallback(() => {
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

  const selectJob = useCallback((job: Job) => {
    setSelectedJobId(job.id);
    if (!job.settings) return;
    setBoost(job.settings.boost);
  }, []);

  const dropHandlers = {
    onDragOver: (event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragActive(true); },
    onDragLeave: () => setDragActive(false),
    onDrop: (event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragActive(false); addFiles(event.dataTransfer.files); },
  };

  if (jobs.length === 0) {
    return <HdrEmpty addFiles={addFiles} dragActive={dragActive} dropHandlers={dropHandlers} />;
  }

  return (
    <HdrProcessorBusy
      dropHandlers={dropHandlers} dragActive={dragActive}
      boost={boost} setBoost={setBoost}
      autoDownload={autoDownload} setAutoDownload={setAutoDownload}
      workerState={workerState} totals={totals}
      selectedJob={selectedJob} selectedNeedsRegeneration={selectedNeedsRegeneration}
      redoSelected={redoSelected} selectJob={selectJob}
      clearJobs={clearJobs} addFiles={addFiles} jobs={jobs}
    />
  );
}

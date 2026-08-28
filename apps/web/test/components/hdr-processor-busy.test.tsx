import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HdrProcessorBusy } from "@/components/hdr-processor-busy";
import type { Job } from "@/lib/hdr-job";

const downloadJob = vi.fn();

vi.mock("@/components/hdr-controls-bar", () => ({
  HdrControlsBar: (props: { onDownload: () => void }) => (
    <button type="button" onClick={props.onDownload}>dl</button>
  ),
}));

vi.mock("@/components/hdr-queue", () => ({
  HdrQueue: () => <div>queue</div>,
}));

vi.mock("@/components/hdr-detail", () => ({
  HdrDetail: () => <div>detail</div>,
}));

function job(): Job {
  return {
    id: "a",
    file: new File(["x"], "a.png", { type: "image/png" }),
    sourceUrl: "blob:a",
    state: "done",
    progress: 100,
    phase: "Done",
  };
}

describe("HdrProcessorBusy", () => {
  it("downloads when a job is selected", () => {
    const selected = job();
    render(
      <HdrProcessorBusy
        dropHandlers={{
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
        }}
        dragActive
        boost={0.5}
        setBoost={vi.fn()}
        autoDownload={false}
        setAutoDownload={vi.fn()}
        workerState="ready"
        totals={{ done: 1, running: 0, failed: 0, total: 1 }}
        selectedJob={selected}
        selectedNeedsRegeneration={false}
        redoSelected={vi.fn()}
        selectJob={vi.fn()}
        clearJobs={vi.fn()}
        addFiles={vi.fn()}
        downloadJob={downloadJob}
        jobs={[selected]}
      />,
    );
    fireEvent.click(screen.getByText("dl"));
    expect(downloadJob).toHaveBeenCalledWith(selected, "selected_button");
  });

  it("skips download when nothing is selected", () => {
    downloadJob.mockClear();
    render(
      <HdrProcessorBusy
        dropHandlers={{
          onDragOver: vi.fn(),
          onDragLeave: vi.fn(),
          onDrop: vi.fn(),
        }}
        dragActive={false}
        boost={0.5}
        setBoost={vi.fn()}
        autoDownload={false}
        setAutoDownload={vi.fn()}
        workerState="ready"
        totals={{ done: 0, running: 0, failed: 0, total: 1 }}
        selectedJob={null}
        selectedNeedsRegeneration={false}
        redoSelected={vi.fn()}
        selectJob={vi.fn()}
        clearJobs={vi.fn()}
        addFiles={vi.fn()}
        downloadJob={downloadJob}
        jobs={[job()]}
      />,
    );
    fireEvent.click(screen.getByText("dl"));
    expect(downloadJob).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HdrControlsBar } from "@/components/hdr-controls-bar";
import type { Job } from "@/lib/hdr-job";

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    file: new File(["x"], "shot.png", { type: "image/png" }),
    sourceUrl: "blob:src",
    state: "done",
    progress: 100,
    phase: "Done",
    ...overrides,
  };
}

const totals = { done: 1, running: 0, failed: 0, total: 1 };

describe("HdrControlsBar", () => {
  it("updates boost and downloads a finished job", () => {
    const setBoost = vi.fn();
    const onDownload = vi.fn();
    render(
      <HdrControlsBar
        boost={0.5}
        setBoost={setBoost}
        autoDownload={false}
        setAutoDownload={vi.fn()}
        workerState="ready"
        totals={totals}
        selectedJob={job()}
        selectedNeedsRegeneration={false}
        redoSelected={vi.fn()}
        onDownload={onDownload}
      />,
    );
    fireEvent.change(screen.getByLabelText("Gain"), { target: { value: "0.8" } });
    expect(setBoost).toHaveBeenCalledWith(0.8);
    fireEvent.click(screen.getByRole("button", { name: /Download/ }));
    expect(onDownload).toHaveBeenCalled();
  });

  it("shows regenerate, worker error, running and failed counts", () => {
    const redo = vi.fn();
    const setAuto = vi.fn();
    render(
      <HdrControlsBar
        boost={0.5}
        setBoost={vi.fn()}
        autoDownload
        setAutoDownload={setAuto}
        workerState="error"
        totals={{ done: 1, running: 2, failed: 3, total: 6 }}
        selectedJob={job({ state: "processing" })}
        selectedNeedsRegeneration
        redoSelected={redo}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByText("Worker error")).toBeInTheDocument();
    expect(screen.getByText("Encoding 2")).toBeInTheDocument();
    expect(screen.getByText("Failed 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Regenerate/ })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Automatically download completed files"));
    expect(setAuto).toHaveBeenCalled();
  });

  it("shows checking worker state and regenerates a selected job", () => {
    const redo = vi.fn();
    render(
      <HdrControlsBar
        boost={0.5}
        setBoost={vi.fn()}
        autoDownload={false}
        setAutoDownload={vi.fn()}
        workerState="checking"
        totals={totals}
        selectedJob={job()}
        selectedNeedsRegeneration
        redoSelected={redo}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByText("Worker checking")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Regenerate/ }));
    expect(redo).toHaveBeenCalled();
  });
});

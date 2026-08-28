import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HdrQueue } from "@/components/hdr-queue";
import type { Job } from "@/lib/hdr-job";

vi.mock("@/components/ultra-word", () => ({
  UltraWord: ({ text }: { text: string }) => <span>{text}</span>,
}));

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    file: new File(["xxxx"], "shot.png", { type: "image/png" }),
    sourceUrl: "blob:src",
    state: "queued",
    progress: 10,
    phase: "Queued",
    settings: { boost: 0.5 },
    ...overrides,
  };
}

describe("HdrQueue", () => {
  it("selects a row, downloads a done job, and adds files", () => {
    const onSelectJob = vi.fn();
    const onDownloadJob = vi.fn();
    const addFiles = vi.fn();
    const done = job({ id: "d", state: "done", progress: 100, bytesOut: 2048, note: "ok" });
    const err = job({ id: "e", state: "error", error: "boom" });
    render(
      <HdrQueue
        jobs={[done, err, job({ id: "q", settings: undefined })]}
        selectedJob={done}
        onSelectJob={onSelectJob}
        onDownloadJob={onDownloadJob}
        clearJobs={vi.fn()}
        dragActive
        addFiles={addFiles}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear queue" }));
    fireEvent.click(screen.getAllByText("Download")[0]!);
    expect(onDownloadJob).toHaveBeenCalledWith(done);
    fireEvent.keyDown(screen.getAllByTestId("job-row")[1]!, { key: "Enter" });
    fireEvent.keyDown(screen.getAllByTestId("job-row")[1]!, { key: " " });
    fireEvent.keyDown(screen.getAllByTestId("job-row")[1]!, { key: "Tab" });
    fireEvent.click(screen.getAllByTestId("job-row")[1]!);
    expect(onSelectJob).toHaveBeenCalled();
    fireEvent.change(document.querySelector("input[type=file]") as HTMLInputElement, {
      target: { files: [new File(["a"], "b.png", { type: "image/png" })] },
    });
    expect(addFiles).toHaveBeenCalled();
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});

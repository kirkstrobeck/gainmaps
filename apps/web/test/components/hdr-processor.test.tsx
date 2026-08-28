import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HdrProcessor } from "@/components/hdr-processor";
import type { Job } from "@/lib/hdr-job";

const ensure = vi.fn();
const runJob = vi.fn();
const dequeue = vi.fn(() => [] as File[]);

vi.mock("@/lib/hdr-worker", () => ({
  concurrencyLimit: () => 2,
  ensureProcessorRegistration: () => ensure(),
  runServiceWorkerJob: (...args: unknown[]) => runJob(...args),
}));

vi.mock("@/lib/file-queue", () => ({
  dequeueFiles: () => dequeue(),
}));

vi.mock("@/components/hdr-empty", () => ({
  HdrEmpty: ({
    addFiles,
    dropHandlers,
  }: {
    addFiles: (files: File[]) => void;
    dropHandlers: { onDragOver: (e: { preventDefault: () => void }) => void; onDragLeave: () => void; onDrop: (e: { preventDefault: () => void; dataTransfer: { files: File[] } }) => void };
  }) => (
    <div>
      <button
        type="button"
        onClick={() => addFiles([new File(["x"], "a.png", { type: "image/png" })])}
      >
        add
      </button>
      <button
        type="button"
        onClick={() => addFiles([new File(["x"], "skip.txt", { type: "text/plain" })])}
      >
        skip
      </button>
      <div
        data-testid="empty-drop"
        onDragOver={(e) => dropHandlers.onDragOver(e)}
        onDragLeave={() => dropHandlers.onDragLeave()}
        onDrop={(e) => dropHandlers.onDrop({ preventDefault: () => undefined, dataTransfer: { files: [new File(["x"], "b.jpg", { type: "image/jpeg" })] } } as never)}
      />
    </div>
  ),
}));

vi.mock("@/components/hdr-controls-bar", () => ({
  HdrControlsBar: (props: {
    setBoost: (n: number) => void;
    setAutoDownload: (v: boolean) => void;
    redoSelected: () => void;
    onDownload: () => void;
    selectedJob: Job | null;
  }) => (
    <div>
      <button type="button" onClick={() => props.setBoost(0.9)}>boost</button>
      <button type="button" onClick={() => props.setAutoDownload(true)}>auto</button>
      <button type="button" onClick={() => props.redoSelected()}>redo</button>
      <button type="button" onClick={() => props.onDownload()}>dl</button>
      <span>{props.selectedJob?.file.name}</span>
    </div>
  ),
}));

vi.mock("@/components/hdr-queue", () => ({
  HdrQueue: (props: { onSelectJob: (job: Job) => void; clearJobs: () => void; jobs: Job[]; dragActive?: boolean }) => (
    <div>
      <button type="button" onClick={() => props.jobs[0] && props.onSelectJob(props.jobs[0])}>select</button>
      <button type="button" onClick={() => props.jobs[0] && props.onSelectJob({ ...props.jobs[0], settings: undefined })}>select-no-settings</button>
      <button type="button" onClick={() => props.clearJobs()}>clear</button>
      {props.dragActive && <span>drag-active</span>}
    </div>
  ),
}));

vi.mock("@/components/hdr-detail", () => ({
  HdrDetail: () => <div data-testid="detail" />,
}));

describe("HdrProcessor", () => {
  beforeEach(() => {
    ensure.mockReset();
    runJob.mockReset();
    dequeue.mockReset();
    dequeue.mockReturnValue([]);
    ensure.mockResolvedValue({});
    runJob.mockImplementation(async (job: Job, _opts: unknown, onUpdate: (j: Job) => void) => {
      onUpdate({ ...job, state: "done", resultUrl: "blob:out", progress: 100 });
    });
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  it("adds files from empty state and processes them", async () => {
    render(<HdrProcessor />);
    fireEvent.click(screen.getByText("add"));
    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());
    fireEvent.click(screen.getByText("boost"));
    fireEvent.click(screen.getByText("auto"));
    fireEvent.click(screen.getByText("select"));
    fireEvent.click(screen.getByText("redo"));
    fireEvent.click(screen.getByText("dl"));
    fireEvent.click(screen.getByText("clear"));
    await waitFor(() => expect(screen.getByText("add")).toBeInTheDocument());
  });

  it("ignores rejected types and handles drop plus worker error", async () => {
    ensure.mockRejectedValue(new Error("no sw"));
    render(<HdrProcessor />);
    fireEvent.click(screen.getByText("skip"));
    expect(screen.getByText("add")).toBeInTheDocument();
    fireEvent.dragOver(screen.getByTestId("empty-drop"));
    fireEvent.dragLeave(screen.getByTestId("empty-drop"));
    fireEvent.drop(screen.getByTestId("empty-drop"));
    await waitFor(() => expect(screen.getByText("b.jpg")).toBeInTheDocument());
  });

  it("loads queued files on mount", async () => {
    dequeue.mockReturnValue([new File(["x"], "from-home.png", { type: "image/png" })]);
    render(<HdrProcessor />);
    await waitFor(() => expect(screen.getByText("from-home.png")).toBeInTheDocument());
  });

  it("selectJob without settings does not update boost", async () => {
    render(<HdrProcessor />);
    fireEvent.click(screen.getByText("add"));
    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());
    // select-no-settings fires onSelectJob with a job that has no settings
    fireEvent.click(screen.getByText("select-no-settings"));
    // Boost stays at default (no throw, no crash)
    expect(screen.getByText("boost")).toBeInTheDocument();
  });

  it("updateJob covers the false branch when multiple jobs exist", async () => {
    dequeue.mockReturnValue([
      new File(["x"], "a.png", { type: "image/png" }),
      new File(["x"], "b.png", { type: "image/png" }),
    ]);
    render(<HdrProcessor />);
    // Both jobs are added and processed; when updateJob runs for one, the other
    // has job.id !== next.id → false branch of the ternary in updateJob is covered
    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());
  });

  it("clearJobs and redoSelected cover resultUrl-absent branch", async () => {
    ensure.mockReturnValue(new Promise(() => {})); // never resolves → workerState stays "checking"
    render(<HdrProcessor />);
    fireEvent.click(screen.getByText("add")); // job added in "queued" state, no resultUrl
    // redo: job has no resultUrl → if (job.resultUrl) false branch in redoSelected
    fireEvent.click(screen.getByText("redo"));
    // clear: redo'd job has no resultUrl → if (job.resultUrl) false branch in clearJobs
    fireEvent.click(screen.getByText("clear"));
    await waitFor(() => expect(screen.getByText("add")).toBeInTheDocument());
  });

  it("drag-over on full layout sets dragActive", async () => {
    render(<HdrProcessor />);
    fireEvent.click(screen.getByText("add"));
    await waitFor(() => expect(screen.getByText("a.png")).toBeInTheDocument());
    // The section itself has the drag handlers
    const section = document.querySelector("section") as HTMLElement;
    fireEvent.dragOver(section);
    await waitFor(() => expect(screen.getByText("drag-active")).toBeInTheDocument());
    fireEvent.dragLeave(section);
    await waitFor(() => expect(screen.queryByText("drag-active")).not.toBeInTheDocument());
  });
});

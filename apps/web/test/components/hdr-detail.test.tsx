import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HdrDetail } from "@/components/hdr-detail";
import type { Job } from "@/lib/hdr-job";

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    file: new File(["xxxx"], "shot.png", { type: "image/png" }),
    sourceUrl: "blob:src",
    state: "processing",
    progress: 40,
    phase: "Encoding",
    settings: { boost: 0.5 },
    ...overrides,
  };
}

describe("HdrDetail", () => {
  it("renders empty preview copy when no job is selected", () => {
    render(<HdrDetail selectedJob={null} boost={0.5} selectedNeedsRegeneration={false} />);
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText(/Ready with gain/)).toBeInTheDocument();
    expect(screen.getByText("Settings matched")).toBeInTheDocument();
  });

  it("renders original image, processing phase, and regeneration hint", () => {
    render(<HdrDetail selectedJob={job()} boost={0.8} selectedNeedsRegeneration />);
    expect(screen.getByAltText("Original shot.png")).toBeInTheDocument();
    expect(screen.getByText("Encoding")).toBeInTheDocument();
    expect(screen.getByText("Re-encode to apply")).toBeInTheDocument();
  });

  it("renders the result image when done", () => {
    render(
      <HdrDetail
        selectedJob={job({ state: "done", resultUrl: "blob:out", settings: undefined })}
        boost={0.2}
        selectedNeedsRegeneration={false}
      />,
    );
    expect(screen.getByAltText("Revised shot.png")).toBeInTheDocument();
    expect(screen.getByText(/Ready with gain/)).toBeInTheDocument();
  });

  it("renders the error state", () => {
    render(
      <HdrDetail
        selectedJob={job({ state: "error", error: "nope" })}
        boost={0.2}
        selectedNeedsRegeneration={false}
      />,
    );
    expect(screen.getByText("nope")).toBeInTheDocument();
  });

  it("renders SvgPreview for SVG sources", () => {
    const svg = job({ file: new File(["<svg/>"], "mark.svg", { type: "image/svg+xml" }) });
    render(<HdrDetail selectedJob={svg} boost={0.2} selectedNeedsRegeneration={false} />);
    expect(screen.getByRole("heading", { name: "mark.svg" })).toBeInTheDocument();
  });
});

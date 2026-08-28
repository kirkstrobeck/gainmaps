import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SvgPreview } from "@/components/svg-preview";

const VALID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect/></svg>`;

function makeSvgFile(content: string, name = "test.svg"): File {
  return new File([content], name, { type: "image/svg+xml" });
}

describe("SvgPreview", () => {
  it("shows loading state initially", () => {
    const file = makeSvgFile(VALID_SVG);
    render(<SvgPreview file={file} />);
    expect(screen.getByText(/loading svg/i)).toBeInTheDocument();
  });

  it("renders SVG markup after file loads", async () => {
    const file = makeSvgFile(VALID_SVG);
    const { container } = render(<SvgPreview file={file} />);
    await waitFor(() => {
      expect(container.querySelector("[class*='preview-svg']")).not.toBeNull();
    });
  });

  it("shows error message when SVG is invalid", async () => {
    vi.spyOn(File.prototype, "text").mockResolvedValueOnce("not svg at all<<<");
    const file = makeSvgFile("ignored", "bad.svg");
    render(<SvgPreview file={file} />);
    await waitFor(() => {
      expect(screen.getByText(/SVG could not be parsed/i)).toBeInTheDocument();
    });
  });

  it("shows error when file.text() rejects", async () => {
    vi.spyOn(File.prototype, "text").mockRejectedValueOnce(new Error("read failed"));
    const file = makeSvgFile(VALID_SVG);
    render(<SvgPreview file={file} />);
    await waitFor(() => {
      expect(screen.getByText(/read failed/i)).toBeInTheDocument();
    });
  });

  it("shows String(reason) when rejection is not an Error", async () => {
    vi.spyOn(File.prototype, "text").mockRejectedValueOnce("plain string rejection");
    const file = makeSvgFile(VALID_SVG);
    render(<SvgPreview file={file} />);
    await waitFor(() => {
      expect(screen.getByText(/plain string rejection/i)).toBeInTheDocument();
    });
  });

  it("passes className to the container", async () => {
    const file = makeSvgFile(VALID_SVG);
    const { container } = render(<SvgPreview file={file} className="my-class" />);
    await waitFor(() => {
      expect(container.querySelector(".my-class")).not.toBeNull();
    });
  });
});

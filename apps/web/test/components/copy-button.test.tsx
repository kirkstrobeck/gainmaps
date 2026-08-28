import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CopyButton } from "@/components/copy-button";

const writeText = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(navigator, { clipboard: { writeText } });
  writeText.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CopyButton", () => {
  it("renders Copy label initially", () => {
    render(<CopyButton text="hello" />);
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("has aria-label Copy by default", () => {
    render(<CopyButton text="hello" />);
    expect(screen.getByLabelText("Copy")).toBeInTheDocument();
  });

  it("shows Copied on success", async () => {
    writeText.mockResolvedValue(undefined);
    render(<CopyButton text="hello" />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Copy"));
      await Promise.resolve();
    });
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("reverts to Copy after 2 seconds on success", async () => {
    writeText.mockResolvedValue(undefined);
    render(<CopyButton text="hello" />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Copy"));
      await Promise.resolve();
    });
    expect(screen.getByText("Copied")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("shows Failed on clipboard error", async () => {
    writeText.mockRejectedValue(new Error("Not allowed"));
    render(<CopyButton text="hello" />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Copy"));
      await Promise.resolve();
    });
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("reverts to Copy after 2 seconds on failure", async () => {
    writeText.mockRejectedValue(new Error("Not allowed"));
    render(<CopyButton text="hello" />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Copy"));
      await Promise.resolve();
    });
    expect(screen.getByText("Failed")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("calls clipboard with provided text", async () => {
    writeText.mockResolvedValue(undefined);
    render(<CopyButton text="npx gainmap ./photos" />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Copy"));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith("npx gainmap ./photos");
  });

  it("accepts optional className", () => {
    render(<CopyButton text="x" className="custom-class" />);
    expect(screen.getByLabelText("Copy").className).toContain("custom-class");
  });

  it("uses label prop as aria-label when provided", () => {
    render(<CopyButton text="x" label="Copy prompt" />);
    expect(screen.getByLabelText("Copy prompt")).toBeInTheDocument();
  });
});

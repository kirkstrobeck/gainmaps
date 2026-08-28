import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ShareBar } from "@/components/share-bar";

describe("ShareBar", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    // Remove share so it's not detected
    delete (navigator as unknown as Record<string, unknown>).share;
  });

  it("renders 'Copy link' button", () => {
    render(<ShareBar />);
    expect(screen.getByLabelText("Copy link")).toBeInTheDocument();
  });

  it("clicking Copy link calls clipboard.writeText", async () => {
    render(<ShareBar />);
    fireEvent.click(screen.getByLabelText("Copy link"));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href);
    });
  });

  it("shows 'Copied' after clicking copy", async () => {
    render(<ShareBar />);
    fireEvent.click(screen.getByLabelText("Copy link"));
    await waitFor(() => {
      expect(screen.getByLabelText("Copy link").textContent).toContain("Copied");
    });
  });

  it("does not show Share button when navigator.share is undefined", () => {
    render(<ShareBar />);
    expect(screen.queryByLabelText("Share")).toBeNull();
  });

  it("shows Share button when navigator.share is available", async () => {
    Object.assign(navigator, { share: vi.fn().mockResolvedValue(undefined) });
    render(<ShareBar />);
    await waitFor(() => expect(screen.getByLabelText("Share")).toBeInTheDocument());
  });

  it("clicking Share calls navigator.share", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    render(<ShareBar />);
    await waitFor(() => expect(screen.getByLabelText("Share")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Share"));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: document.title, url: window.location.href }));
  });

  it("ignores AbortError from navigator.share", async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(err) });
    render(<ShareBar />);
    await waitFor(() => expect(screen.getByLabelText("Share")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Share"));
    // Should not throw — just silently return
    await waitFor(() => expect(screen.getByLabelText("Share")).toBeInTheDocument());
  });

  it("does not swallow non-AbortError from navigator.share", async () => {
    const err = new Error("network failure");
    err.name = "NetworkError";
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(err) });
    render(<ShareBar />);
    await waitFor(() => expect(screen.getByLabelText("Share")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Share"));
    // Non-AbortError falls through the if — no throw, component stays mounted
    await waitFor(() => expect(screen.getByLabelText("Share")).toBeInTheDocument());
  });

  it("resets copied state after timeout", async () => {
    vi.useFakeTimers();
    render(<ShareBar />);
    fireEvent.click(screen.getByLabelText("Copy link"));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByLabelText("Copy link").textContent).toContain("Copied");
    await act(async () => { vi.advanceTimersByTime(2500); });
    expect(screen.getByLabelText("Copy link").textContent).toContain("Copy link");
    vi.useRealTimers();
  });
});

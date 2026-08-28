import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { UltraFillCanvas } from "@/components/ultra-fill-canvas";
import { SITE_APPEARANCE_EVENT } from "@/lib/site-appearance";

const start = vi.fn(() => ({ poke: vi.fn(), stop: vi.fn() }));

vi.mock("@/lib/ultra-fill", () => ({
  startUltraFill: (...args: unknown[]) => start(...args),
}));

describe("UltraFillCanvas", () => {
  beforeEach(() => {
    start.mockClear();
    document.documentElement.dataset.ultra = "on";
  });

  afterEach(() => {
    delete document.documentElement.dataset.ultra;
  });

  it("starts a session when ultra is on and tears it down", () => {
    const { unmount } = render(<UltraFillCanvas intensity={4} className="x" />);
    expect(start).toHaveBeenCalled();
    window.dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new CustomEvent(SITE_APPEARANCE_EVENT, { detail: { ultra: "off" } }));
    window.dispatchEvent(new CustomEvent(SITE_APPEARANCE_EVENT, { detail: { ultra: "on" } }));
    unmount();
  });

  it("does not start when ultra is off, then starts on appearance event", () => {
    document.documentElement.dataset.ultra = "off";
    render(<UltraFillCanvas intensity={2} />);
    expect(start).not.toHaveBeenCalled();
    window.dispatchEvent(new CustomEvent(SITE_APPEARANCE_EVENT, { detail: { ultra: "on" } }));
    expect(start).toHaveBeenCalled();
  });
});

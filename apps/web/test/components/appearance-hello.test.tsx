import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { AppearanceHello } from "@/components/appearance-hello";

const poke = vi.fn();
const stop = vi.fn();

vi.mock("@/lib/appearance-hello", () => ({
  startAppearanceHello: () => ({ poke, stop }),
}));

describe("AppearanceHello", () => {
  it("does nothing without a lab host", () => {
    const { unmount } = render(<AppearanceHello />);
    expect(poke).not.toHaveBeenCalled();
    unmount();
  });

  it("starts a session and pokes on lab mutations", () => {
    const lab = document.createElement("div");
    lab.className = "appearance-lab";
    document.body.appendChild(lab);
    const { unmount } = render(<AppearanceHello />);
    expect(stop).not.toHaveBeenCalled();
    lab.dataset.ultra = "on";
    unmount();
    expect(stop).toHaveBeenCalled();
    lab.remove();
  });
});

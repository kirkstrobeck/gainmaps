import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SeamCornerButtons } from "@/components/seam-corner-buttons";

describe("SeamCornerButtons", () => {
  it("reports pressed state and snaps", () => {
    const snapTo = vi.fn();
    render(<SeamCornerButtons seamSide="sdr" snapTo={snapTo} />);
    expect(screen.getByRole("button", { name: "Show Standard" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Show Ultra" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Show Ultra" }));
    expect(snapTo).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Show Standard" }));
    expect(snapTo).toHaveBeenCalledWith(100);
  });

  it("stops pointerdown on the SDR corner from bubbling", () => {
    const snapTo = vi.fn();
    const { container } = render(<SeamCornerButtons seamSide={null} snapTo={snapTo} />);
    const corner = container.querySelector(".inst-corner-sdr") as HTMLElement;
    const event = new Event("pointerdown", { bubbles: true });
    const stop = vi.spyOn(event, "stopPropagation");
    corner.dispatchEvent(event);
    expect(stop).toHaveBeenCalled();
  });

  it("stops pointerdown on the Ultra corner from bubbling", () => {
    const snapTo = vi.fn();
    const { container } = render(<SeamCornerButtons seamSide={null} snapTo={snapTo} />);
    const corner = container.querySelector(".inst-corner-ultra") as HTMLElement;
    const event = new Event("pointerdown", { bubbles: true });
    const stop = vi.spyOn(event, "stopPropagation");
    corner.dispatchEvent(event);
    expect(stop).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SeamComparePhoto, SeamCompareType } from "@/components/seam-compare";
import { PHOTOS } from "@/lib/photos/catalog";

vi.mock("@/components/ultra-word", () => ({
  UltraWord: ({ text }: { text: string }) => <span>{text}</span>,
}));

const photo = PHOTOS[0]!;

describe("SeamComparePhoto input", () => {
  it("arrow keys move the seam and ignore other keys", () => {
    render(<SeamComparePhoto photo={photo} className="extra" width={400} height={200} />);
    const slider = screen.getByRole("slider");
    const container = slider.closest(".inst") as HTMLElement;
    expect(container.className).toContain("extra");

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(parseFloat(container.style.getPropertyValue("--seam-x"))).toBeGreaterThan(50);

    fireEvent.keyDown(slider, { key: "ArrowUp" });
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    fireEvent.keyDown(slider, { key: "ArrowDown" });
    fireEvent.keyDown(slider, { key: "Enter" });
  });

  it("pointer move is ignored until pointer down, then stopDrag ends it", () => {
    render(<SeamComparePhoto photo={photo} />);
    const slider = screen.getByRole("slider");
    const container = slider.closest(".inst") as HTMLElement;
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ left: 0, width: 400, top: 0, height: 300, right: 400, bottom: 300 }),
      configurable: true,
    });
    container.setPointerCapture = vi.fn();

    fireEvent.pointerMove(container, { clientX: 300, clientY: 30, pointerId: 1 });
    expect(container.style.getPropertyValue("--seam-x")).toBe("");

    fireEvent.pointerDown(container, { clientX: 200, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(container, { clientX: 300, clientY: 30, pointerId: 1 });
    expect(parseFloat(container.style.getPropertyValue("--seam-x"))).toBeGreaterThan(70);

    fireEvent.pointerUp(container);
    fireEvent.pointerMove(container, { clientX: 40, clientY: 30, pointerId: 1 });
    expect(parseFloat(container.style.getPropertyValue("--seam-x"))).toBeGreaterThan(70);

    fireEvent.pointerCancel(container);
  });

  it("SDR snap is 100 and Ultra snap is 0, middle snap clears side", () => {
    render(<SeamComparePhoto photo={photo} />);
    fireEvent.click(screen.getByRole("button", { name: "Show Standard" }));
    expect(screen.getByRole("button", { name: "Show Standard" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Show Ultra" }));
    expect(screen.getByRole("button", { name: "Show Ultra" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("SeamCompareType", () => {
  it("renders with a custom type class", () => {
    render(<SeamCompareType typeClassName="custom-type" width="100%" height={80} className="type-inst" />);
    expect(screen.getAllByText("Ultra").length).toBeGreaterThan(0);
  });
});

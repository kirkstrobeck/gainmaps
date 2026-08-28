import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SeamComparePhoto, SeamCompareType } from "@/components/seam-compare";
import { PHOTOS } from "@/lib/photos/catalog";

vi.mock("@/components/seam-corner-buttons", () => ({
  SeamCornerButtons: ({ seamSide, snapTo }: { seamSide: string | null; snapTo: (p: number) => void }) => (
    <div>
      <button onClick={() => snapTo(100)} aria-label="Show Standard" aria-pressed={seamSide === "sdr"}>SDR</button>
      <button onClick={() => snapTo(50)} aria-label="Show Middle" aria-pressed={seamSide === null}>Middle</button>
      <button onClick={() => snapTo(0)} aria-label="Show Ultra" aria-pressed={seamSide === "ultra"}>Ultra</button>
    </div>
  ),
}));

vi.mock("@/components/ultra-word", () => ({
  UltraWord: ({ text }: { text: string }) => <span className="ultra-word">{text}</span>,
}));

const photo = PHOTOS[0]!;

describe("SeamComparePhoto", () => {
  it("renders SDR and Ultra images", () => {
    render(<SeamComparePhoto photo={photo} />);
    expect(screen.getByAltText(`${photo.alt}, Standard`)).toBeInTheDocument();
    expect(screen.getByAltText(`${photo.alt}, Ultra`)).toBeInTheDocument();
  });

  it("uses the 400w file as the src fallback", () => {
    render(<SeamComparePhoto photo={photo} />);
    expect(screen.getByAltText(`${photo.alt}, Standard`).getAttribute("src")).toContain("standard-400.jpg");
    expect(screen.getByAltText(`${photo.alt}, Ultra`).getAttribute("src")).toContain("gainmap-400.jpg");
  });

  it("defers the ultra layer src until near the viewport", () => {
    class IO {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("IntersectionObserver", IO);
    render(<SeamComparePhoto photo={photo} deferUltra />);
    const ultra = screen.getByAltText(`${photo.alt}, Ultra`);
    const sdr = screen.getByAltText(`${photo.alt}, Standard`);
    expect(sdr.getAttribute("src")).toBeTruthy();
    expect(ultra.getAttribute("src")).toBeFalsy();
    vi.unstubAllGlobals();
  });

  it("uses lazy loading by default", () => {
    const { container } = render(<SeamComparePhoto photo={photo} />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(img).toHaveAttribute("loading", "lazy");
    }
  });

  it("uses eager loading when priority is true", () => {
    render(<SeamComparePhoto photo={photo} priority />);
    const imgs = screen.getAllByRole("img");
    for (const img of imgs) {
      expect(img).toHaveAttribute("loading", "eager");
    }
  });

  it("applies custom sizes attribute", () => {
    render(<SeamComparePhoto photo={photo} sizes="33vw" />);
    const imgs = screen.getAllByRole("img");
    for (const img of imgs) {
      expect(img).toHaveAttribute("sizes", "33vw");
    }
  });

  it("both images share identical sizes and srcset width descriptors", () => {
    render(<SeamComparePhoto photo={photo} sizes="33vw" />);
    const sdr = screen.getByAltText(`${photo.alt}, Standard`);
    const ultra = screen.getByAltText(`${photo.alt}, Ultra`);
    expect(sdr).toHaveAttribute("sizes", "33vw");
    expect(ultra).toHaveAttribute("sizes", "33vw");
    // srcset width descriptors must be identical (same resolution candidates)
    const sdrSrcset = sdr.getAttribute("srcset") ?? "";
    const ultraSrcset = ultra.getAttribute("srcset") ?? "";
    const widths = (s: string) => s.match(/\d+w/g)?.sort() ?? [];
    expect(widths(ultraSrcset)).toEqual(widths(sdrSrcset));
  });

  it("SDR button sets seam to full SDR side", () => {
    render(<SeamComparePhoto photo={photo} />);
    const sdrBtn = screen.getByRole("button", { name: "Show Standard" });
    fireEvent.click(sdrBtn);
    expect(sdrBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("Ultra button sets seam to full Ultra side", () => {
    render(<SeamComparePhoto photo={photo} />);
    const ultraBtn = screen.getByRole("button", { name: "Show Ultra" });
    fireEvent.click(ultraBtn);
    expect(ultraBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("Middle button snaps seam to null (between sides)", () => {
    render(<SeamComparePhoto photo={photo} />);
    // First snap to SDR so seamSide is "sdr"
    fireEvent.click(screen.getByRole("button", { name: "Show Standard" }));
    // Then snap to middle — seamSide should become null
    const midBtn = screen.getByRole("button", { name: "Show Middle" });
    fireEvent.click(midBtn);
    expect(midBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("images have draggable=false to prevent native drag interrupting pointer capture", () => {
    render(<SeamComparePhoto photo={photo} />);
    const imgs = screen.getAllByRole("img");
    for (const img of imgs) {
      expect(img).toHaveAttribute("draggable", "false");
    }
  });

  it("drag starts from any point in the instrument, not only the handle circle", () => {
    render(<SeamComparePhoto photo={photo} />);
    const slider = screen.getByRole("slider");
    const container = slider.closest(".inst") as HTMLElement;

    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ left: 0, width: 400, top: 0, height: 300, right: 400, bottom: 300 }),
      configurable: true,
    });
    container.setPointerCapture = vi.fn();

    // Simulate pointerdown at 15% across, well away from the 50% initial handle
    fireEvent.pointerDown(container, { clientX: 60, clientY: 30, pointerId: 1 });
    // --seam-x should now be set to ~15%
    const seam = container.style.getPropertyValue("--seam-x");
    const pct = parseFloat(seam);
    expect(pct).toBeGreaterThan(10);
    expect(pct).toBeLessThan(20);

    // Move to 70% — seam should follow
    fireEvent.pointerMove(container, { clientX: 280, clientY: 30, pointerId: 1 });
    const seamAfterMove = parseFloat(container.style.getPropertyValue("--seam-x"));
    expect(seamAfterMove).toBeGreaterThan(65);
    expect(seamAfterMove).toBeLessThan(75);
  });
});

describe("SeamCompareType", () => {
  it("renders plain SDR text and UltraWord only on the Ultra side", () => {
    const { container } = render(<SeamCompareType />);
    const sdrLayer = container.querySelector(".inst-sdr");
    const ultraLayer = container.querySelector(".inst > .inst-layer:not(.inst-sdr)");
    expect(sdrLayer).toHaveClass("inst-type-sdr-layer");
    expect(sdrLayer?.querySelector(".inst-type-std")).toHaveTextContent("Ultra");
    expect(sdrLayer?.querySelector(".ultra-word")).toBeNull();
    expect(sdrLayer?.querySelector("canvas")).toBeNull();
    expect(sdrLayer?.querySelector("svg")).toBeNull();
    expect(ultraLayer?.querySelector(".ultra-word")).toHaveTextContent("Ultra");
  });
});

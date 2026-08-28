import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DisplayCheckModal } from "@/components/display-check-modal";
import { openDisplayCheck } from "@/lib/display-check-store";

describe("DisplayCheckModal", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.style.overflow = "";
  });

  it("shows the display question when not previously dismissed", () => {
    render(<DisplayCheckModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Can you see the symbol?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("shows the yes answer and dismisses", () => {
    render(<DisplayCheckModal />);
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(screen.getByText("Yes, you can see it.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("display-check-dismissed")).toBe("1");
  });

  it("shows the no answer with three square example photos", () => {
    render(<DisplayCheckModal />);
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(screen.getByText(/No, you can.t/)).toBeInTheDocument();
    expect(screen.getByText(/hard to show what this display cannot show/)).toBeInTheDocument();
    expect(screen.getByText(/These photos help demonstrate the effect/)).toBeInTheDocument();
    expect(screen.getByLabelText("Photos that help show the Ultra effect")).toBeInTheDocument();
    const examples = screen.getAllByAltText(/Photo .*effect|Close-up photo/);
    expect(examples).toHaveLength(3);
    for (const image of examples) {
      expect(image).toHaveClass("aspect-square", "object-cover");
      expect(image).toHaveAttribute("src", expect.stringContaining("/display-check/examples/example-"));
    }
  });

  it("stays hidden when already dismissed", () => {
    localStorage.setItem("display-check-dismissed", "1");
    render(<DisplayCheckModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stops inner click from bubbling and restores focus on dismiss", () => {
    const prior = document.createElement("button");
    document.body.appendChild(prior);
    prior.focus();
    render(<DisplayCheckModal />);
    const dialog = screen.getByRole("dialog");
    const event = new MouseEvent("click", { bubbles: true });
    const stop = vi.spyOn(event, "stopPropagation");
    dialog.dispatchEvent(event);
    expect(stop).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    prior.remove();
  });

  it("dismisses on Escape key", () => {
    render(<DisplayCheckModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("presentation"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("display-check-dismissed")).toBe("1");
  });

  it("ignores a non-Escape key on the overlay", () => {
    render(<DisplayCheckModal />);
    fireEvent.keyDown(screen.getByRole("presentation"), { key: "Enter" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("dismisses on click-outside", () => {
    render(<DisplayCheckModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem("display-check-dismissed")).toBe("1");
  });

  it("reopens via openDisplayCheck after dismissal", async () => {
    render(<DisplayCheckModal />);
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => { openDisplayCheck(); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Can you see the symbol?")).toBeInTheDocument();
  });
});

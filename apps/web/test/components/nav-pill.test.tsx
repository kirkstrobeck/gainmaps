import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NavPill } from "@/components/nav-pill";

describe("NavPill", () => {
  it("renders left and right labels", () => {
    render(<NavPill leftLabel="A" rightLabel="B" leftActive={true} onToggle={vi.fn()} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("button has role switch", () => {
    const { container } = render(<NavPill leftLabel="A" rightLabel="B" leftActive={true} onToggle={vi.fn()} />);
    expect(container.querySelector('[role="switch"]')).not.toBeNull();
  });

  it("aria-checked reflects leftActive=true", () => {
    render(<NavPill leftLabel="A" rightLabel="B" leftActive={true} onToggle={vi.fn()} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("aria-checked reflects leftActive=false", () => {
    render(<NavPill leftLabel="A" rightLabel="B" leftActive={false} onToggle={vi.fn()} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<NavPill leftLabel="A" rightLabel="B" leftActive={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("sets aria-label when label prop provided", () => {
    render(
      <NavPill leftLabel="A" rightLabel="B" leftActive={true} onToggle={vi.fn()} label="Toggle mode" />,
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-label", "Toggle mode");
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HdrEmpty } from "@/components/hdr-empty";

vi.mock("@/components/install-switcher", () => ({
  InstallSwitcher: () => <div data-testid="install" />,
}));

vi.mock("@/components/ultra-word", () => ({
  UltraWord: ({ text }: { text: string }) => <span>{text}</span>,
}));

describe("HdrEmpty", () => {
  it("renders drop copy and forwards files", () => {
    const addFiles = vi.fn();
    const dropHandlers = {
      onDragOver: vi.fn(),
      onDragLeave: vi.fn(),
      onDrop: vi.fn(),
    };
    render(<HdrEmpty addFiles={addFiles} dragActive={false} dropHandlers={dropHandlers} />);
    expect(screen.getByText(/Drop images here to make them HDR/)).toBeInTheDocument();
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(addFiles).toHaveBeenCalled();
  });

  it("applies drag-active styles", () => {
    const { container } = render(
      <HdrEmpty
        addFiles={vi.fn()}
        dragActive
        dropHandlers={{ onDragOver: vi.fn(), onDragLeave: vi.fn(), onDrop: vi.fn() }}
      />,
    );
    expect(container.querySelector("section")?.className).toContain("bg-[");
    fireEvent.change(document.querySelector("input[type=file]") as HTMLInputElement, {
      target: { files: null },
    });
  });
});

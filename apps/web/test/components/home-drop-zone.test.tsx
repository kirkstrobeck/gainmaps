import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HomeDropZone } from "@/components/home-drop-zone";
import { navState } from "@/test/helpers/nav";
import { dequeueFiles } from "@/lib/file-queue";

vi.mock("@/components/ultra-icon", () => ({
  UltraIcon: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe("HomeDropZone", () => {
  it("renders the optional label and ignores rejected files", () => {
    render(<HomeDropZone label="INSTANT IN BROWSER" />);
    expect(screen.getByText("INSTANT IN BROWSER")).toBeInTheDocument();
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const bad = new File(["x"], "notes.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [bad] } });
    expect(navState.push).not.toHaveBeenCalled();
  });

  it("enqueues accepted files and navigates to convert", () => {
    render(<HomeDropZone />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const good = new File(["x"], "shot.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [good] } });
    expect(navState.push).toHaveBeenCalledWith("/convert");
    expect(dequeueFiles()[0]?.name).toBe("shot.jpg");
  });

  it("handles drag over, leave, drop, and empty drop", () => {
    const { container } = render(<HomeDropZone />);
    const zone = container.querySelector(".home-drop-zone") as HTMLElement;
    fireEvent.dragOver(zone);
    expect(screen.getByText("Release to convert")).toBeInTheDocument();
    fireEvent.dragLeave(zone);
    expect(screen.getByText("Drop an image")).toBeInTheDocument();

    const png = new File(["x"], "mark.svg", { type: "image/svg+xml" });
    fireEvent.drop(zone, { dataTransfer: { files: [png] } });
    expect(navState.push).toHaveBeenCalledWith("/convert");
    dequeueFiles();

    fireEvent.drop(zone, { dataTransfer: { files: [] } });
  });
});

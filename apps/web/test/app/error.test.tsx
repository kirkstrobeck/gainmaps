import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/ultra-word", () => ({
  UltraWord: ({ text }: { text: string }) => <span>{text}</span>,
}));

import ErrorPage from "@/app/error";

describe("ErrorPage", () => {
  it("renders an error message", () => {
    render(<ErrorPage error={new Error("test")} reset={() => {}} />);
    expect(screen.getByText(/something failed/i)).toBeInTheDocument();
  });

  it("renders a heading to reload", () => {
    const { container } = render(<ErrorPage error={new Error("test")} reset={() => {}} />);
    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toMatch(/reload the processor/i);
  });

  it("calls reset when Try again is clicked", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("test")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/ultra-word", () => ({
  UltraWord: ({ text }: { text: string }) => <span>{text}</span>,
}));

import NotFound from "@/app/not-found";

describe("NotFound", () => {
  it("renders 404 status text", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders 'Page not found' heading", () => {
    const { container } = render(<NotFound />);
    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toMatch(/page not found/i);
  });

  it("renders link back to home", () => {
    const { container } = render(<NotFound />);
    const link = container.querySelector('a[href="/"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toMatch(/return home/i);
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TextPageClient } from "@/app/text/client";
import { navState } from "@/test/helpers/nav";

vi.mock("@/components/site-nav", () => ({
  SiteNav: () => <nav data-testid="nav" />,
}));

vi.mock("@/components/ultra-word", () => ({
  UltraWord: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@/components/ultra-skill-card", () => ({
  UltraSkillCard: () => <div data-testid="ultra-skill-card"><button aria-label="Copy skill" /><button aria-label="Copy prompt" /></div>,
}));

describe("TextPageClient", () => {
  it("clamps intensity from the search param and writes it back", () => {
    navState.searchGet.mockReturnValue("150");
    render(<TextPageClient />);
    const slider = screen.getByLabelText("Intensity");
    expect(slider).toHaveValue("100");
    fireEvent.change(slider, { target: { value: "20" } });
    expect(navState.replace).toHaveBeenCalled();
  });

  it("defaults when the search param is not a number", () => {
    navState.searchGet.mockReturnValue("nope");
    render(<TextPageClient />);
    expect(screen.getByLabelText("Intensity")).toBeInTheDocument();
  });

  it("links direct visitors to implementation and developer docs", () => {
    navState.searchGet.mockReturnValue(null);
    render(<TextPageClient />);
    expect(screen.getByRole("heading", { name: "Build this into your interface" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Implementation/ })).toHaveAttribute("href", "/developers#agent-skill");
    expect(screen.getByRole("link", { name: /Developer docs/ })).toHaveAttribute("href", "/developers#cli");
    expect(screen.getByRole("link", { name: /How gain maps work/ })).toHaveAttribute("href", "/docs#gain");
    expect(screen.getByTestId("ultra-skill-card")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy skill")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy prompt")).toBeInTheDocument();
  });
});

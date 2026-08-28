import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UltraSkillCard } from "@/components/ultra-skill-card";

describe("UltraSkillCard", () => {
  it("renders the heading", () => {
    render(<UltraSkillCard />);
    expect(screen.getByText(/add ultra text to your project/i)).toBeInTheDocument();
  });

  it("renders the npx command text", () => {
    render(<UltraSkillCard />);
    expect(screen.getByText(/npx skills add kirkstrobeck\/gainmaps/i)).toBeInTheDocument();
    expect(screen.getAllByText(/recommended path/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Copy skill")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy prompt")).toBeInTheDocument();
  });

  it("renders a link to GitHub", () => {
    const { container } = render(<UltraSkillCard />);
    const link = container.querySelector('a[href*="github.com"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toContain("skills/ultra-text");
  });

  it("hides heading when hideHeading is true", () => {
    render(<UltraSkillCard hideHeading />);
    expect(screen.queryByText(/add ultra text to your project/i)).not.toBeInTheDocument();
    expect(screen.getByText(/npx skills add kirkstrobeck\/gainmaps/i)).toBeInTheDocument();
  });
});

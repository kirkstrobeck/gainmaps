import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "@/components/site-footer";
import { FOOTER_LINKS } from "@/lib/nav";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

describe("SiteFooter", () => {
  it("renders all footer nav links", () => {
    render(<SiteFooter />);
    for (const { label, href } of FOOTER_LINKS) {
      const link = screen.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", href);
    }
  });

  it("renders the credit link", () => {
    render(<SiteFooter />);
    expect(screen.getByText("Made by Kirk Strobeck")).toBeInTheDocument();
  });
});

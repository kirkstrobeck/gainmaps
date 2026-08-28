import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogosGrid } from "@/components/logos-grid";
import type { Company } from "@/lib/logos/companies";

vi.mock("@/components/logo-pair", () => ({
  LogoPair: ({ company }: { company: Company }) => <span data-testid="logo-pair">{company.name}</span>,
}));

function makeCompanies(count: number): Company[] {
  return Array.from({ length: count }, (_, i) => ({
    slug: `company-${i}`,
    name: `Company ${i}`,
    rank: i + 1,
    svgPath: `/logos/company-${i}/logo.svg`,
    gainmapPath: `/logos/company-${i}/logo-gainmap.jpg`,
    sdrPath: `/logos/company-${i}/logo-sdr.jpg`,
  }));
}

describe("LogosGrid", () => {
  it("renders the first 24 companies", () => {
    const companies = makeCompanies(30);
    render(<LogosGrid companies={companies} />);
    const pairs = screen.getAllByTestId("logo-pair");
    expect(pairs.length).toBe(24);
  });

  it("renders all companies when count ≤ PAGE_SIZE", () => {
    const companies = makeCompanies(10);
    render(<LogosGrid companies={companies} />);
    const pairs = screen.getAllByTestId("logo-pair");
    expect(pairs.length).toBe(10);
  });

  it("shows 'Show more' button when there are more than 24", () => {
    const companies = makeCompanies(30);
    render(<LogosGrid companies={companies} />);
    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
  });

  it("does not show 'Show more' button when all fit on first page", () => {
    const companies = makeCompanies(10);
    render(<LogosGrid companies={companies} />);
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
  });

  it("shows more companies on button click", () => {
    const companies = makeCompanies(30);
    render(<LogosGrid companies={companies} />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    const pairs = screen.getAllByTestId("logo-pair");
    expect(pairs.length).toBe(30);
  });

  it("shows remaining count in button label", () => {
    const companies = makeCompanies(30);
    render(<LogosGrid companies={companies} />);
    expect(screen.getByRole("button", { name: /6 remaining/i })).toBeInTheDocument();
  });

  it("each card links company name to detail page (no outer anchor)", () => {
    const companies = makeCompanies(3);
    render(<LogosGrid companies={companies} />);
    const link = screen.getByRole("link", { name: "Company 0" });
    expect(link).toHaveAttribute("href", "/logos/company-0");
    // The li itself should not be a link
    const listItems = document.querySelectorAll("li");
    expect(listItems[0]?.tagName).toBe("LI");
  });
});

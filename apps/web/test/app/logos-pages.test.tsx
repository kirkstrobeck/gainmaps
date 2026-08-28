import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { COMPANIES } from "@/lib/logos/companies";
import { navState } from "@/test/helpers/nav";

vi.mock("@/components/page-chrome", () => ({
  PageChrome: () => <div data-testid="chrome" />,
}));

vi.mock("@/components/ultra-word", () => ({
  UltraWord: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@/components/ultra-icon", () => ({
  UltraIcon: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/logos-grid", () => ({
  LogosGrid: () => <div data-testid="grid" />,
}));

vi.mock("@/components/logo-pair", () => ({
  LogoPair: () => <div data-testid="pair" />,
}));

describe("logos index", () => {
  it("renders the logos heading", async () => {
    const Base = (await import("@/app/logos/page")).default;
    render(<Base />);
    expect(screen.getByRole("heading", { name: "Logos" })).toBeInTheDocument();
  });
});

describe("logos/[slug]", () => {
  it("generateStaticParams matches the company list", async () => {
    const { generateStaticParams } = await import("@/app/logos/[slug]/page");
    expect(generateStaticParams()).toHaveLength(COMPANIES.length);
  });

  it("generateMetadata uses the company name", async () => {
    const { generateMetadata } = await import("@/app/logos/[slug]/page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: COMPANIES[0]!.slug }) });
    expect(meta.title).toContain(COMPANIES[0]!.name);
  });

  it("generateMetadata falls back for a missing slug", async () => {
    const { generateMetadata } = await import("@/app/logos/[slug]/page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "nope" }) });
    expect(meta.title).toBe("Logos · Gainmaps");
  });

  it("renders a 2025-ranked company with neighbours", async () => {
    const Base = (await import("@/app/logos/[slug]/page")).default;
    const ui = await Base({ params: Promise.resolve({ slug: COMPANIES[1]!.slug }) });
    render(ui);
    expect(screen.getByText(COMPANIES[1]!.name)).toBeInTheDocument();
    expect(screen.getByText(/Interbrand Best Global Brands 2025/)).toBeInTheDocument();
  });

  it("renders American Express with the 2024 ranking copy", async () => {
    const amex = COMPANIES.find((c) => c.slug === "american-express")!;
    const Base = (await import("@/app/logos/[slug]/page")).default;
    const ui = await Base({ params: Promise.resolve({ slug: amex.slug }) });
    render(ui);
    expect(screen.getByText("Interbrand Best Global Brands 2024")).toBeInTheDocument();
  });

  it("renders the first company without a previous neighbour", async () => {
    const Base = (await import("@/app/logos/[slug]/page")).default;
    const ui = await Base({ params: Promise.resolve({ slug: COMPANIES[0]!.slug }) });
    render(ui);
    expect(screen.getByRole("link", { name: "All logos" })).toHaveAttribute("href", "/logos");
  });

  it("calls notFound for an unknown slug", async () => {
    const Base = (await import("@/app/logos/[slug]/page")).default;
    await expect(Base({ params: Promise.resolve({ slug: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navState.notFound).toHaveBeenCalled();
  });
});

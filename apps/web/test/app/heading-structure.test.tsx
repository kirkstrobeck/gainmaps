import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { headerState } from "@/test/helpers/nav";
import { PHOTOS } from "@/lib/photos/catalog";

vi.mock("@/components/hero-section", () => ({
  HeroSection: ({ comparePhoto, id }: { comparePhoto: { slug: string }; id?: string }) => (
    <div data-testid="hero" id={id}>
      <h1>Gainmaps</h1>
      {comparePhoto.slug}
    </div>
  ),
}));

vi.mock("@/components/image-proof-section", () => ({
  ImageProofSection: () => <div data-testid="proof" />,
}));

vi.mock("@/components/home-drop-zone", () => ({
  HomeDropZone: () => <div data-testid="drop" />,
}));

vi.mock("@/components/install-switcher", () => ({
  InstallSwitcher: () => <div data-testid="install" />,
}));

vi.mock("@/components/ultra-skill-card", () => ({
  UltraSkillCard: () => <div data-testid="skill" />,
}));

vi.mock("@/components/site-nav", () => ({
  SiteNav: () => <nav data-testid="nav" />,
}));

vi.mock("@/components/ultra-icon", () => ({
  UltraIcon: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/lib/shuffle", () => ({
  shuffle: <T,>(items: T[]) => items,
}));

describe("heading structure", () => {
  it("homepage has exactly one h1", async () => {
    headerState.heroSlug = PHOTOS[0]!.slug;
    const Base = (await import("@/app/page")).default;
    const ui = await Base({ searchParams: Promise.resolve({}) });
    const { container } = render(ui);
    const h1s = container.querySelectorAll("h1");
    expect(h1s.length).toBe(1);
  });

  it("homepage has at least one h2", async () => {
    headerState.heroSlug = PHOTOS[0]!.slug;
    const Base = (await import("@/app/page")).default;
    const ui = await Base({ searchParams: Promise.resolve({}) });
    const { container } = render(ui);
    const h2s = container.querySelectorAll("h2");
    expect(h2s.length).toBeGreaterThan(0);
  });

  it("homepage has no h4 or deeper headings", async () => {
    headerState.heroSlug = PHOTOS[0]!.slug;
    const Base = (await import("@/app/page")).default;
    const ui = await Base({ searchParams: Promise.resolve({}) });
    const { container } = render(ui);
    const h4plus = container.querySelectorAll("h4, h5, h6");
    expect(h4plus.length).toBe(0);
  });
});

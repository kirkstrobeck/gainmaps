import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { headerState } from "@/test/helpers/nav";
import { PHOTOS } from "@/lib/photos/catalog";
import { PRODUCT_HUNT_URL } from "@/lib/product-hunt";

vi.mock("@/components/hero-section", () => ({
  HeroSection: ({ comparePhoto, rotationPhotos, id }: { comparePhoto: { slug: string }; rotationPhotos?: readonly { slug: string }[]; id?: string }) => (
    <div data-testid="hero" data-rotation-count={rotationPhotos?.length ?? 0} id={id}>{comparePhoto.slug}</div>
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

describe("home page", () => {
  it("picks a hero from the x-hero-photo-slug header", async () => {
    headerState.heroSlug = PHOTOS[1]!.slug;
    const Base = (await import("@/app/page")).default;
    const ui = await Base({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByTestId("hero")).toHaveTextContent(PHOTOS[1]!.slug);
    expect(screen.getByTestId("hero")).toHaveAttribute("id", "main-content");
    expect(screen.getByTestId("hero")).toHaveAttribute("data-rotation-count", "9");
  });

  it("falls back to a random pool photo excluding the last-photo cookie", async () => {
    headerState.heroSlug = null;
    headerState.cookie = { "last-photo": PHOTOS[0]!.slug };
    vi.spyOn(Math, "random").mockReturnValue(0);
    const Base = (await import("@/app/page")).default;
    const ui = await Base({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByTestId("hero").textContent).not.toBe(PHOTOS[0]!.slug);
    expect(screen.getByText("What is a gain map image?")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("ignores an unknown hero slug and still renders", async () => {
    headerState.heroSlug = "not-a-real-slug";
    vi.spyOn(Math, "random").mockReturnValue(0);
    const Base = (await import("@/app/page")).default;
    const ui = await Base({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByTestId("hero")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("uses full PHOTOS pool when no header and no cookie are set", async () => {
    headerState.heroSlug = null;
    headerState.cookie = {};
    vi.spyOn(Math, "random").mockReturnValue(0);
    const Base = (await import("@/app/page")).default;
    const ui = await Base({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByTestId("hero")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("links to the Product Hunt product page", async () => {
    headerState.heroSlug = null;
    headerState.cookie = {};
    const Base = (await import("@/app/page")).default;
    const ui = await Base({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByRole("link", { name: "Upvote on Product Hunt" })).toHaveAttribute("href", PRODUCT_HUNT_URL);
  });
});

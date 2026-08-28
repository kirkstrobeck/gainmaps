import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PHOTOS } from "@/lib/photos/catalog";
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

vi.mock("@/components/photo-pair", () => ({
  PhotoPair: () => <div data-testid="pair" />,
  PhotoCredit: () => <div data-testid="credit" />,
}));

describe("photos/[slug]", () => {
  it("generateStaticParams returns every catalog slug", async () => {
    const { generateStaticParams } = await import("@/app/photos/[slug]/page");
    expect(generateStaticParams()).toHaveLength(PHOTOS.length);
  });

  it("generateMetadata uses the photo title when found", async () => {
    const { generateMetadata } = await import("@/app/photos/[slug]/page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: PHOTOS[0]!.slug }) });
    expect(meta.title).toContain(PHOTOS[0]!.alt);
  });

  it("generateMetadata falls back when the slug is missing", async () => {
    const { generateMetadata } = await import("@/app/photos/[slug]/page");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "nope" }) });
    expect(meta.title).toBe("Photos · Gainmaps");
  });

  it("renders a middle photo with prev and next neighbours", async () => {
    const Base = (await import("@/app/photos/[slug]/page")).default;
    const ui = await Base({ params: Promise.resolve({ slug: PHOTOS[1]!.slug }) });
    render(ui);
    expect(screen.getByText(PHOTOS[1]!.photographer)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: PHOTOS[0]!.alt })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: PHOTOS[2]!.alt })).toBeInTheDocument();
    expect(screen.getByText("Unsplash original")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: PHOTOS[1]!.photoUrl })).toHaveAttribute("target", "_blank");
  });

  it("renders the first photo without a previous neighbour", async () => {
    const Base = (await import("@/app/photos/[slug]/page")).default;
    const ui = await Base({ params: Promise.resolve({ slug: PHOTOS[0]!.slug }) });
    render(ui);
    expect(screen.getByRole("link", { name: "All photos" })).toHaveAttribute("href", "/photos");
  });

  it("calls notFound for an unknown slug", async () => {
    const Base = (await import("@/app/photos/[slug]/page")).default;
    await expect(Base({ params: Promise.resolve({ slug: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navState.notFound).toHaveBeenCalled();
  });
});

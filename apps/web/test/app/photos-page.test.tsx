import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PHOTOS } from "@/lib/photos/catalog";

vi.mock("@/components/page-chrome", () => ({
  PageChrome: () => <div data-testid="chrome" />,
}));

vi.mock("@/components/ultra-word", () => ({
  UltraWord: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@/components/ultra-icon", () => ({
  UltraIcon: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/seam-compare", () => ({
  SeamComparePhoto: ({ photo }: { photo: { alt: string } }) => <img alt={photo.alt} />,
}));

describe("photos index", () => {
  it("renders page 1 without a previous link", async () => {
    const Base = (await import("@/app/photos/page")).default;
    const ui = await Base({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByRole("heading", { name: "Photos" })).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(document.querySelector(".photo-card")).not.toBeNull();
  });

  it("renders a middle page from an array search param", async () => {
    const Base = (await import("@/app/photos/page")).default;
    const ui = await Base({ searchParams: Promise.resolve({ page: ["2"] }) });
    render(ui);
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("renders the last page without a next link", async () => {
    const Base = (await import("@/app/photos/page")).default;
    const ui = await Base({ searchParams: Promise.resolve({ page: "99" }) });
    render(ui);
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
    expect(PHOTOS.length).toBeGreaterThan(0);
  });
});

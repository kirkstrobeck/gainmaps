import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SiteAppearanceToggle } from "@/components/site-appearance-toggle";

vi.mock("@/components/ultra-icon", () => ({
  UltraIcon: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe("SiteAppearanceToggle", () => {
  it("commits light, dark, ultra off, and ultra on", () => {
    render(<SiteAppearanceToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Off" }));
    fireEvent.click(screen.getByRole("button", { name: "On" }));
    expect(screen.getByRole("group", { name: "Color mode" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Ultra display" })).toBeInTheDocument();
  });
});

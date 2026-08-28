import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { navState } from "@/test/helpers/nav";

// Use vi.hoisted so writeSiteAppearance is available inside the vi.mock factory.
const { writeSiteAppearance } = vi.hoisted(() => ({ writeSiteAppearance: vi.fn() }));

// Override the flag so NavPill controls render and the commit() path is reachable.
vi.mock("@/lib/site-appearance-controls", () => ({ SHOW_APPEARANCE_CONTROLS: true }));

vi.mock("@/components/ultra-word", () => ({
  UltraWord: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@/components/ultra-icon", () => ({
  UltraIcon: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

// Stub NavPill so we can click its toggle without a real pill UI.
vi.mock("@/components/nav-pill", () => ({
  NavPill: ({ label, onToggle }: { label: string; onToggle: () => void }) => (
    <button onClick={onToggle}>{label}</button>
  ),
}));

vi.mock("@/lib/site-appearance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/site-appearance")>();
  return { ...actual, writeSiteAppearance };
});

import { SiteNav } from "@/components/site-nav";

describe("SiteNav commit() path (SHOW_APPEARANCE_CONTROLS = true)", () => {
  it("commit writes appearance when color-mode NavPill is toggled", () => {
    navState.pathname = "/";
    render(<SiteNav />);
    const colorModeBtn = screen.getByRole("button", { name: "Color mode" });
    fireEvent.click(colorModeBtn);
    expect(writeSiteAppearance).toHaveBeenCalled();
  });

  it("commit writes appearance when ultra-display NavPill is toggled", () => {
    writeSiteAppearance.mockClear();
    navState.pathname = "/";
    render(<SiteNav />);
    const ultraBtns = screen.getAllByRole("button", { name: "Ultra display" });
    fireEvent.click(ultraBtns[0]!);
    expect(writeSiteAppearance).toHaveBeenCalled();
  });

  it("mobile-header Ultra display NavPill: ultra=on→off branch", () => {
    writeSiteAppearance.mockClear();
    navState.pathname = "/";
    // Default ultra is "on"; clicking covers the ultra !== "off" → "off" branch
    render(<SiteNav />);
    const ultraBtns = screen.getAllByRole("button", { name: "Ultra display" });
    fireEvent.click(ultraBtns[ultraBtns.length - 1]!);
    expect(writeSiteAppearance).toHaveBeenCalled();
  });

  it("mobile-header Ultra display NavPill: ultra=off→on branch", () => {
    writeSiteAppearance.mockClear();
    navState.pathname = "/";
    // Set ultra to "off" so clicking covers the ultra === "off" → "on" branch
    document.documentElement.setAttribute("data-ultra", "off");
    window.dispatchEvent(new CustomEvent("site-appearance"));
    render(<SiteNav />);
    const ultraBtns = screen.getAllByRole("button", { name: "Ultra display" });
    fireEvent.click(ultraBtns[ultraBtns.length - 1]!);
    expect(writeSiteAppearance).toHaveBeenCalled();
    document.documentElement.removeAttribute("data-ultra");
  });

  it("mobile menu Color mode NavPill: mode=dark→light branch", () => {
    writeSiteAppearance.mockClear();
    navState.pathname = "/";
    // Default mode is "dark"; clicking covers the mode === "dark" → "light" branch
    render(<SiteNav />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const colorBtns = screen.getAllByRole("button", { name: "Color mode" });
    fireEvent.click(colorBtns[colorBtns.length - 1]!);
    expect(writeSiteAppearance).toHaveBeenCalled();
  });

  it("mobile menu Color mode NavPill: mode=light→dark branch", () => {
    writeSiteAppearance.mockClear();
    navState.pathname = "/";
    // Set mode to "light" so clicking covers the mode !== "dark" → "dark" branch
    document.documentElement.setAttribute("data-mode", "light");
    window.dispatchEvent(new CustomEvent("site-appearance"));
    render(<SiteNav />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const colorBtns = screen.getAllByRole("button", { name: "Color mode" });
    fireEvent.click(colorBtns[colorBtns.length - 1]!);
    expect(writeSiteAppearance).toHaveBeenCalled();
    document.documentElement.removeAttribute("data-mode");
  });
});

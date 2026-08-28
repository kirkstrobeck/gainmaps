import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { headerState } from "@/test/helpers/nav";

vi.mock("@/components/site-nav", () => ({
  SiteNav: () => <nav data-testid="nav" />,
}));

vi.mock("@/components/ultra-word", () => ({
  UltraWord: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@/components/appearance-hello", () => ({
  AppearanceHello: () => <div data-testid="hello" />,
}));

vi.mock("@/components/appearance-controls", () => ({
  AppearanceControls: ({ initial }: { initial: { mode: string; ultra: boolean; intensity: number; system: boolean } }) => (
    <div data-testid="controls">{`${initial.mode}:${initial.ultra}:${initial.intensity}:${initial.system}`}</div>
  ),
}));

describe("appearance page", () => {
  it("reads cookie defaults", async () => {
    const Base = (await import("@/app/appearance/page")).default;
    const ui = await Base({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByTestId("controls").textContent).toContain("dark");
  });

  it("parses URL params including arrays and invalid intensity", async () => {
    headerState.cookie = {
      "site-mode": "light",
      "site-ultra": "off",
      "site-intensity": "40",
    };
    const Base = (await import("@/app/appearance/page")).default;
    const ui = await Base({
      searchParams: Promise.resolve({
        mode: ["dark"],
        ultra: ["on"],
        intensity: ["not-a-number"],
        system: "off",
      }),
    });
    render(ui);
    expect(screen.getByTestId("controls").textContent).toContain("dark:true");
    expect(screen.getByTestId("controls").textContent).toContain("false");
  });

  it("clamps intensity from a numeric string", async () => {
    const Base = (await import("@/app/appearance/page")).default;
    const ui = await Base({
      searchParams: Promise.resolve({ intensity: "250", system: "on" }),
    });
    render(ui);
    expect(screen.getByTestId("controls").textContent).toContain("100");
  });
});

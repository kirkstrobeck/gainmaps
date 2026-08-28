import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteAppearanceProvider, useSiteAppearance } from "@/components/site-appearance-provider";

function Consumer() {
  const { mode, ultra } = useSiteAppearance();
  return <div data-testid="output">{mode}:{ultra}</div>;
}

describe("SiteAppearanceProvider", () => {
  it("provides initial appearance values to children", () => {
    document.documentElement.dataset.mode = "light";
    document.documentElement.dataset.ultra = "off";
    render(
      <SiteAppearanceProvider initial={{ mode: "light", ultra: "off" }}>
        <Consumer />
      </SiteAppearanceProvider>,
    );
    expect(screen.getByTestId("output").textContent).toBe("light:off");
    delete document.documentElement.dataset.mode;
    delete document.documentElement.dataset.ultra;
  });

  it("provides dark/on defaults when document state matches", () => {
    document.documentElement.dataset.mode = "dark";
    document.documentElement.dataset.ultra = "on";
    render(
      <SiteAppearanceProvider initial={{ mode: "dark", ultra: "on" }}>
        <Consumer />
      </SiteAppearanceProvider>,
    );
    expect(screen.getByTestId("output").textContent).toBe("dark:on");
    delete document.documentElement.dataset.mode;
    delete document.documentElement.dataset.ultra;
  });
});

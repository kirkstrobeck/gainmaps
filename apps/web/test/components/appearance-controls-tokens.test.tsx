import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppearanceControls } from "@/components/appearance-controls";

function hostLab(): HTMLElement {
  const existing = document.querySelector(".appearance-lab");
  existing?.remove();
  const lab = document.createElement("div");
  lab.className = "appearance-lab";
  document.body.appendChild(lab);
  return lab;
}

describe("AppearanceControls HDR tokens", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.appearanceEdr;
  });

  it("paints rec2100 tokens when CSS.supports allows color-hdr", () => {
    const lab = hostLab();
    Object.defineProperty(window, "CSS", {
      configurable: true,
      value: {
        supports: (prop: string, value: string) => prop === "color" && value.includes("color-hdr"),
      },
    });
    render(
      <AppearanceControls initial={{ mode: "light", system: false, ultra: true, intensity: 80 }} />,
    );
    expect(lab.style.getPropertyValue("--accent").length).toBeGreaterThan(0);
  });

  it("falls back to rec2100-linear when color-hdr is unsupported", () => {
    const lab = hostLab();
    Object.defineProperty(window, "CSS", {
      configurable: true,
      value: {
        supports: (_prop: string, value: string) => value.startsWith("color(rec2100-linear"),
      },
    });
    render(
      <AppearanceControls initial={{ mode: "dark", system: false, ultra: true, intensity: 80 }} />,
    );
    expect(lab.style.getPropertyValue("--foreground").length).toBeGreaterThan(0);
  });

  it("keeps SDR tokens when CSS.supports rejects HDR syntax", () => {
    hostLab();
    Object.defineProperty(window, "CSS", {
      configurable: true,
      value: { supports: () => false },
    });
    render(
      <AppearanceControls initial={{ mode: "dark", system: false, ultra: true, intensity: 80 }} />,
    );
    expect(document.documentElement.dataset.appearanceEdr).toBe("on");
  });

  it("clears tokens when ultra is off", () => {
    const lab = hostLab();
    render(
      <AppearanceControls initial={{ mode: "dark", system: false, ultra: false, intensity: 80 }} />,
    );
    expect(lab.style.getPropertyValue("--accent")).toBe("");
    expect(document.documentElement.dataset.appearanceEdr).toBeUndefined();
  });

  it("listens to prefers-color-scheme changes", () => {
    const listeners: Array<() => void> = [];
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: () => ({
        matches: true,
        addEventListener: (_e: string, fn: () => void) => listeners.push(fn),
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
        media: "",
        onchange: null,
      }),
    });
    hostLab();
    const { unmount } = render(
      <AppearanceControls initial={{ mode: "light", system: true, ultra: true, intensity: 10 }} />,
    );
    for (const fn of listeners) fn();
    unmount();
  });

  it("renders the intensity slider when ultra is on", () => {
    hostLab();
    render(
      <AppearanceControls initial={{ mode: "dark", system: false, ultra: true, intensity: 20 }} />,
    );
    expect(screen.getByLabelText("Ultra intensity")).toBeInTheDocument();
  });
});

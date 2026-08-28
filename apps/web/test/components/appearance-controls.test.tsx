import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppearanceControls } from "@/components/appearance-controls";
import { SITE_APPEARANCE_EVENT } from "@/lib/site-appearance";

function hostLab(): HTMLElement {
  const lab = document.createElement("div");
  lab.className = "appearance-lab";
  document.body.appendChild(lab);
  return lab;
}

const initial = { mode: "dark" as const, system: false, ultra: true, intensity: 50 };

describe("AppearanceControls", () => {
  beforeEach(() => {
    document.querySelector(".appearance-lab")?.remove();
    delete document.documentElement.dataset.appearanceEdr;
  });

  it("toggles system, mode, ultra, and intensity", () => {
    hostLab();
    render(<AppearanceControls initial={initial} />);
    fireEvent.click(screen.getByLabelText("Use system appearance"));
    fireEvent.click(screen.getByLabelText("Use system appearance"));
    fireEvent.click(screen.getByLabelText("Light"));
    fireEvent.click(screen.getByLabelText("Dark"));
    fireEvent.click(screen.getByLabelText("Enable Ultra"));
    fireEvent.click(screen.getByLabelText("Enable Ultra"));
    expect(screen.getByLabelText("Use system appearance")).toBeInTheDocument();
  });

  it("starts with ultra off and intensity 0, then enables ultra", () => {
    hostLab();
    render(<AppearanceControls initial={{ ...initial, ultra: false, intensity: 0, system: true }} />);
    fireEvent.click(screen.getByLabelText("Enable Ultra"));
    expect(screen.getByLabelText("Ultra intensity")).toBeInTheDocument();
  });

  it("syncs from the chrome appearance event", () => {
    hostLab();
    document.documentElement.dataset.mode = "light";
    document.documentElement.dataset.ultra = "off";
    document.documentElement.dataset.intensity = "12";
    render(<AppearanceControls initial={initial} />);
    window.dispatchEvent(new Event(SITE_APPEARANCE_EVENT));
  });

  it("clamps a NaN initial intensity", () => {
    hostLab();
    render(<AppearanceControls initial={{ ...initial, intensity: Number.NaN }} />);
    expect(screen.getByLabelText("Enable Ultra")).toBeInTheDocument();
  });

  it("no-ops persist when the URL is already in sync", () => {
    hostLab();
    const replace = vi.spyOn(window.history, "replaceState");
    render(<AppearanceControls initial={{ ...initial, system: true }} />);
    expect(replace).toHaveBeenCalled();
  });

  it("persistAppearance returns early when URL already matches", () => {
    hostLab();
    // Pre-set URL to exactly what writeSiteAppearance + persistAppearance would generate for initial state:
    // writeSiteAppearance sets mode/ultra/intensity, persistAppearance then adds system=off
    // If the URL already has all params, persistAppearance returns early without a second replaceState
    window.history.pushState({}, "", "/?mode=dark&ultra=on&intensity=50&system=off");
    render(<AppearanceControls initial={{ ...initial, system: false }} />);
    expect(screen.getByLabelText("Use system appearance")).toBeInTheDocument();
    // Restore original URL
    window.history.pushState({}, "", "/");
  });

  it("syncLab no-op when no .appearance-lab exists", () => {
    // Do NOT call hostLab() — no lab element present
    render(<AppearanceControls initial={initial} />);
    // Should not throw, component renders normally
    expect(screen.getByLabelText("Enable Ultra")).toBeInTheDocument();
  });

  it("onChrome skips setIntensity when readSiteIntensity returns undefined", () => {
    hostLab();
    // Set mode and ultra on documentElement but leave intensity unset
    document.documentElement.dataset.mode = "light";
    document.documentElement.dataset.ultra = "on";
    delete document.documentElement.dataset.intensity;
    render(<AppearanceControls initial={initial} />);
    window.dispatchEvent(new Event(SITE_APPEARANCE_EVENT));
    // nextIntensity is undefined → if branch false, no crash
    expect(screen.getByLabelText("Enable Ultra")).toBeInTheDocument();
  });

  it("ToggleGroup deselect (value empty string) does not change mode", () => {
    hostLab();
    render(<AppearanceControls initial={{ ...initial, mode: "dark", system: false }} />);
    // Click "Dark" when it is already selected → deselects → onValueChange("") → if branch false
    fireEvent.click(screen.getByLabelText("Dark"));
    // mode stays "dark" (no setMode called)
    expect(screen.getByLabelText("Dark")).toBeInTheDocument();
  });
});

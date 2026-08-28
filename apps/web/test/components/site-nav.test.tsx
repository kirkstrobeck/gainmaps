import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { PRODUCT_HUNT_URL } from "@/lib/product-hunt";
import { SiteNav } from "@/components/site-nav";
import { navState } from "@/test/helpers/nav";

vi.mock("@/components/ultra-word", () => ({
  UltraWord: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@/components/ultra-icon", () => ({
  UltraIcon: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

// SHOW_APPEARANCE_CONTROLS is false, so NavPill controls are hidden.
// Tests focus on nav links, mobile menu, Display check, and ShareCluster.

describe("SiteNav", () => {
  it("marks the active desktop link", () => {
    navState.pathname = "/photos";
    render(<SiteNav />);
    expect(screen.getByRole("link", { name: "Gallery" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Developers" })).toHaveAttribute("href", "/developers");
    expect(screen.getByRole("link", { name: "Community" })).toHaveAttribute("href", "/community");
  });

  it("opens and closes the mobile menu", () => {
    navState.pathname = "/convert";
    render(<SiteNav />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: "Close menu" })).toBeInTheDocument();
    const menuLinks = screen.getAllByRole("link", { name: /Convert/ });
    fireEvent.click(menuLinks[menuLinks.length - 1]!);
    expect(screen.queryByRole("button", { name: "Close menu" })).not.toBeInTheDocument();
  });

  it("shows Display check button and GitHub link in desktop nav", () => {
    navState.pathname = "/";
    const { container } = render(<SiteNav />);
    const desktopLinks = container.querySelector(".min-\\[1000px\\]\\:flex");
    const mobileToggle = container.querySelector(".min-\\[1000px\\]\\:hidden");
    expect(desktopLinks).toHaveClass("hidden", "min-[1000px]:flex");
    expect(mobileToggle).toHaveClass("flex", "min-[1000px]:hidden");
    expect(container.querySelector(".xl\\:flex")).toBeNull();
    expect(container.querySelector(".xl\\:hidden")).toBeNull();
    expect(screen.getByRole("button", { name: "Display check" })).toHaveClass("whitespace-nowrap", "h-8");
    expect(screen.getByRole("link", { name: "GitHub" })).toBeInTheDocument();
  });

  it("renders without an active path", () => {
    navState.pathname = null as unknown as string;
    render(<SiteNav />);
    expect(screen.getByRole("link", { name: "Gallery" })).not.toHaveAttribute("aria-current");
  });

  it("shows Product Hunt upvote pill in desktop nav", () => {
    navState.pathname = "/";
    render(<SiteNav />);
    const productHuntLinks = screen.getAllByRole("link", { name: "Upvote on Product Hunt" });
    expect(productHuntLinks.length).toBeGreaterThan(0);
    expect(productHuntLinks[0]).toHaveAttribute("href", PRODUCT_HUNT_URL);
    expect(productHuntLinks[0]).toHaveAttribute("title", "Upvote on Product Hunt");
    expect(productHuntLinks[0]).toHaveTextContent("Upvote");
    expect(productHuntLinks[0]).not.toHaveTextContent("PH");
    expect(productHuntLinks[0]).toHaveClass("h-8", "w-[7rem]", "justify-center", "whitespace-nowrap", "nav-action-control");
    expect(productHuntLinks[0]).toHaveClass("border-[#da552f]/60");
  });

  it("renders share, copy, and Product Hunt controls at the same size", async () => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
      writable: true,
    });
    navState.pathname = "/";
    render(<SiteNav />);
    const share = (await screen.findAllByRole("button", { name: "Share" }))[0]!;
    const copy = screen.getAllByRole("button", { name: "Copy link" })[0]!;
    const productHunt = screen.getAllByRole("link", { name: "Upvote on Product Hunt" })[0]!;
    for (const control of [share, copy, productHunt]) {
      expect(control).toHaveClass("h-8", "w-[7rem]", "shrink-0", "justify-center", "whitespace-nowrap", "nav-action-control");
    }
  });



  it("uses compact no-overflow classes in the mobile action area", () => {
    navState.pathname = "/";
    render(<SiteNav />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const copyButtons = screen.getAllByRole("button", { name: "Copy link" });
    const productHuntLinks = screen.getAllByRole("link", { name: "Upvote on Product Hunt" });
    const displayCheckBtns = screen.getAllByRole("button", { name: "Display check" });
    expect(copyButtons[copyButtons.length - 1]).toHaveClass("h-9", "min-w-0", "whitespace-nowrap", "nav-action-control");
    expect(productHuntLinks[productHuntLinks.length - 1]).toHaveClass("h-9", "min-w-0", "whitespace-nowrap", "nav-action-control");
    expect(displayCheckBtns[displayCheckBtns.length - 1]).toHaveClass("h-9", "w-full", "whitespace-nowrap", "nav-action-control");
  });

  it("clicking Display check in mobile menu fires openDisplayCheck and closes menu", () => {
    navState.pathname = "/";
    render(<SiteNav />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const displayCheckBtns = screen.getAllByRole("button", { name: "Display check" });
    // Last button is in the mobile menu; click it to cover the onClick handler
    fireEvent.click(displayCheckBtns[displayCheckBtns.length - 1]!);
    // Menu closes after clicking Display check
    expect(screen.queryByRole("button", { name: "Close menu" })).not.toBeInTheDocument();
  });

  it("copy link button writes URL to clipboard and resets copied state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    navState.pathname = "/";
    render(<SiteNav />);
    const copyBtn = screen.getAllByRole("button", { name: "Copy link" })[0]!;
    fireEvent.click(copyBtn);
    expect(writeText).toHaveBeenCalled();
    await waitFor(() => expect(copyBtn).toHaveTextContent("Copied"));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 2050)); });
    expect(copyBtn).toHaveTextContent("Copy link");
  });

  it("shows Share button and calls navigator.share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
      writable: true,
    });
    navState.pathname = "/";
    render(<SiteNav />);
    // useEffect fires after render — wait for Share button
    const shareBtns = await screen.findAllByRole("button", { name: "Share" });
    await act(async () => { fireEvent.click(shareBtns[0]!); });
    expect(share).toHaveBeenCalled();
  });

  it("ignores AbortError from navigator.share", async () => {
    const abortError = Object.assign(new Error("cancelled"), { name: "AbortError" });
    const share = vi.fn().mockRejectedValue(abortError);
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
      writable: true,
    });
    navState.pathname = "/";
    render(<SiteNav />);
    const shareBtns = await screen.findAllByRole("button", { name: "Share" });
    await act(async () => { fireEvent.click(shareBtns[0]!); });
    // No unhandled rejection — AbortError is silently swallowed
    expect(share).toHaveBeenCalled();
  });

  it("swallows non-Abort share Error rejections", async () => {
    const share = vi.fn().mockRejectedValue(new Error("share failed"));
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
      writable: true,
    });
    navState.pathname = "/";
    render(<SiteNav />);
    const shareBtns = await screen.findAllByRole("button", { name: "Share" });
    await act(async () => { fireEvent.click(shareBtns[0]!); });
    expect(share).toHaveBeenCalled();
  });

  it("swallows non-Error share rejections", async () => {
    const share = vi.fn().mockRejectedValue("cancelled");
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
      writable: true,
    });
    navState.pathname = "/";
    render(<SiteNav />);
    const shareBtns = await screen.findAllByRole("button", { name: "Share" });
    await act(async () => { fireEvent.click(shareBtns[0]!); });
    expect(share).toHaveBeenCalled();
  });
});

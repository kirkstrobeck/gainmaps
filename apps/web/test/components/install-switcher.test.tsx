import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InstallSwitcher } from "@/components/install-switcher";
import { INSTALL_COMMANDS } from "@/lib/install-commands";

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe("InstallSwitcher", () => {
  it("renders all three tabs", () => {
    render(<InstallSwitcher />);
    expect(screen.getByText("npm")).toBeInTheDocument();
    expect(screen.getByText("brew")).toBeInTheDocument();
    expect(screen.getByText("curl")).toBeInTheDocument();
  });

  it("shows npm command by default", () => {
    render(<InstallSwitcher />);
    expect(screen.getByText(INSTALL_COMMANDS.npm)).toBeInTheDocument();
  });

  it("switches to brew tab on click", () => {
    render(<InstallSwitcher />);
    fireEvent.click(screen.getByText("brew"));
    expect(screen.getByText(INSTALL_COMMANDS.brew)).toBeInTheDocument();
  });

  it("switches to curl tab on click", () => {
    render(<InstallSwitcher />);
    fireEvent.click(screen.getByText("curl"));
    expect(screen.getByText(INSTALL_COMMANDS.curl)).toBeInTheDocument();
  });

  it("switches back to npm tab", () => {
    render(<InstallSwitcher />);
    fireEvent.click(screen.getByText("brew"));
    fireEvent.click(screen.getByText("npm"));
    expect(screen.getByText(INSTALL_COMMANDS.npm)).toBeInTheDocument();
  });

  it("renders a copy button", () => {
    render(<InstallSwitcher />);
    expect(screen.getByLabelText("Copy")).toBeInTheDocument();
  });
});

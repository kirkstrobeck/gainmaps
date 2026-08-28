import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/page-chrome", () => ({
  PageChrome: () => <div data-testid="chrome" />,
}));

vi.mock("@/components/ultra-word", () => ({
  UltraWord: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@/components/ultra-icon", () => ({
  UltraIcon: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ultra-skill-card", () => ({
  UltraSkillCard: () => <div data-testid="skill" />,
}));

vi.mock("@/components/community-comments", () => ({
  CommunityComments: () => <div data-testid="comments" />,
}));

vi.mock("@/components/hdr-processor", () => ({
  HdrProcessor: () => <div data-testid="processor" />,
}));

vi.mock("@/components/icons", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/icons")>();
  const Icon = () => <svg />;
  return Object.fromEntries(
    Object.keys(actual).map((k) => [k, Icon])
  );
});

describe("static marketing pages", () => {
  it("renders how-it-works", async () => {
    const Base = (await import("@/app/convert/how-it-works/page")).default;
    render(<Base />);
    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
  });

  it("renders developers", async () => {
    const Base = (await import("@/app/developers/page")).default;
    render(<Base />);
    expect(screen.getByText("Developers")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CLI" })).toBeInTheDocument();
  });

  it("renders docs", async () => {
    const Base = (await import("@/app/docs/page")).default;
    render(<Base />);
    expect(screen.getByRole("heading", { name: "Names" })).toBeInTheDocument();
    expect(screen.getByText("Ultra HDR Image Format v1.1")).toBeInTheDocument();
    expect(screen.getByText("Applying Apple HDR effect")).toBeInTheDocument();
    expect(screen.getByText("CSS Color HDR Module Level 1")).toBeInTheDocument();
    expect(screen.getByText("ISO 21496-1:2025")).toBeInTheDocument();
  });

  it("renders community", async () => {
    const Base = (await import("@/app/community/page")).default;
    render(<Base />);
    expect(screen.getByRole("heading", { name: "Community" })).toBeInTheDocument();
    expect(screen.getByTestId("comments")).toBeInTheDocument();
  });

  it("renders convert", async () => {
    const Base = (await import("@/app/convert/page")).default;
    render(<Base />);
    expect(screen.getByTestId("processor")).toBeInTheDocument();
  });

  it("renders the text page suspense shell", async () => {
    const Base = (await import("@/app/text/page")).default;
    render(<Base />);
  });
});

describe("trust anchor pages", () => {
  it("renders about", async () => {
    const Base = (await import("@/app/about/page")).default;
    render(<Base />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();
  });

  it("renders contact", async () => {
    const Base = (await import("@/app/contact/page")).default;
    render(<Base />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
  });

  it("renders privacy", async () => {
    const Base = (await import("@/app/privacy/page")).default;
    render(<Base />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Privacy")).toBeInTheDocument();
  });
});

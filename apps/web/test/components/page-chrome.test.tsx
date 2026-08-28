import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { PageChrome } from "@/components/page-chrome";

vi.mock("@/components/site-nav", () => ({
  SiteNav: () => <nav data-testid="site-nav" />,
}));

vi.mock("@/components/share-bar", () => ({
  ShareBar: () => <div data-testid="share-bar" />,
}));

describe("PageChrome", () => {
  it("renders SiteNav and ShareBar", () => {
    const { getByTestId } = render(<PageChrome />);
    expect(getByTestId("site-nav")).toBeInTheDocument();
    expect(getByTestId("share-bar")).toBeInTheDocument();
  });
});

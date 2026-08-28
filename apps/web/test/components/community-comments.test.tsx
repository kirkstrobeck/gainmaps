import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { CommunityComments } from "@/components/community-comments";

vi.mock("@giscus/react", () => ({
  default: (props: { theme: string }) => <div data-testid="giscus" data-theme={props.theme} />,
}));

const mockMode = { value: "light" };

vi.mock("@/components/site-appearance-provider", () => ({
  useSiteAppearance: () => ({ mode: mockMode.value, ultra: "on" }),
}));

describe("CommunityComments", () => {
  it("uses the light giscus theme in light mode", () => {
    mockMode.value = "light";
    const { getByTestId } = render(<CommunityComments />);
    expect(getByTestId("giscus")).toHaveAttribute("data-theme", "light");
  });

  it("uses the dark giscus theme in dark mode", () => {
    mockMode.value = "dark";
    const { getByTestId } = render(<CommunityComments />);
    expect(getByTestId("giscus")).toHaveAttribute("data-theme", "dark");
  });
});

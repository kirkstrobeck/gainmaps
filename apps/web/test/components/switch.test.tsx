import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("thumb has no transition-transform class (snap, no slide)", () => {
    const { container } = render(<Switch aria-label="test" />);
    const thumb = container.querySelector('[data-state]');
    expect(thumb?.className ?? "").not.toContain("transition-transform");
  });
});

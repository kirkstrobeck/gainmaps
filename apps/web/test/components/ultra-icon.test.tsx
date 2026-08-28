import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { UltraIcon } from "@/components/ultra-icon";

describe("UltraIcon", () => {
  it("returns null for a non-element child", () => {
    const { container } = render(<UltraIcon>{("nope" as unknown) as React.ReactElement}</UltraIcon>);
    expect(container.querySelector(".ultra-icon")).toBeNull();
  });

  it("masks a glyph at the given size", () => {
    const { container } = render(
      <UltraIcon size={24} className="extra" intensity={2}>
        <svg />
      </UltraIcon>,
    );
    const root = container.querySelector(".ultra-icon") as HTMLElement;
    expect(root.style.width).toBe("24px");
    expect(root.className).toContain("extra");
    expect(container.querySelector("canvas")).not.toBeNull();
  });
});

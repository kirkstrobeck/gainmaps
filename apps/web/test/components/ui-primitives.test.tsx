import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

describe("ui primitives", () => {
  it("Button renders variants and asChild", () => {
    const { rerender } = render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
    rerender(<Button variant="secondary">Go</Button>);
    rerender(<Button variant="ghost">Go</Button>);
    rerender(
      <Button asChild>
        <a href="/x">link</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute("href", "/x");
  });

  it("Progress clamps values", () => {
    const { rerender } = render(<Progress value={-10} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    rerender(<Progress value={150} className="extra" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    rerender(<Progress value={40} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  });

  it("Label, Toggle, Switch, Slider, and ToggleGroup render", () => {
    const onChecked = vi.fn();
    const onValue = vi.fn();
    render(
      <div>
        <Label htmlFor="x">Name</Label>
        <Toggle variant="outline" size="sm" aria-label="t">T</Toggle>
        <Toggle size="lg" aria-label="t2">T2</Toggle>
        <Switch aria-label="sw" onCheckedChange={onChecked} />
        <Slider value={[40]} onValueChange={onValue} aria-label="s" />
        <Slider value={[40]} thumbLabel="40" aria-label="s2" />
        <ToggleGroup type="single" onValueChange={onValue}>
          <ToggleGroupItem value="a" variant="outline" size="sm">A</ToggleGroupItem>
        </ToggleGroup>
      </div>,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("sw"));
    expect(onChecked).toHaveBeenCalled();
  });
});

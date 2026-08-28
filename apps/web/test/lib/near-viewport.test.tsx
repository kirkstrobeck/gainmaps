import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useRef } from "react";
import { useNearViewport } from "@/lib/near-viewport";

afterEach(() => {
  vi.unstubAllGlobals();
});

function Probe({
  enabled,
  node,
  rootMargin,
}: {
  enabled: boolean;
  node: Element | null;
  rootMargin?: string;
}) {
  const ref = useRef<Element | null>(node);
  ref.current = node;
  const near = useNearViewport(ref, enabled, rootMargin);
  return <span>{near ? "near" : "far"}</span>;
}

describe("useNearViewport", () => {
  it("starts near when disabled", () => {
    render(<Probe enabled={false} node={document.createElement("div")} />);
    expect(screen.getByText("near")).toBeInTheDocument();
  });

  it("starts far when enabled and becomes near without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const node = document.createElement("div");
    render(<Probe enabled node={node} />);
    expect(screen.getByText("near")).toBeInTheDocument();
  });

  it("returns far when the ref has no node", () => {
    class IO {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("IntersectionObserver", IO);
    render(<Probe enabled node={null} />);
    expect(screen.getByText("far")).toBeInTheDocument();
  });

  it("sets near when the observer reports intersecting", () => {
    const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    class IO {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observers.push(cb);
      }
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("IntersectionObserver", IO);
    const node = document.createElement("div");
    render(<Probe enabled node={node} />);
    expect(screen.getByText("far")).toBeInTheDocument();
    act(() => {
      observers[0]!([{ isIntersecting: false }]);
    });
    expect(screen.getByText("far")).toBeInTheDocument();
    act(() => {
      observers[0]!([{ isIntersecting: true }]);
    });
    expect(screen.getByText("near")).toBeInTheDocument();
  });

  it("disconnects on unmount", () => {
    const disconnect = vi.fn();
    class IO {
      observe(): void {}
      disconnect(): void { disconnect(); }
    }
    vi.stubGlobal("IntersectionObserver", IO);
    const node = document.createElement("div");
    const view = render(<Probe enabled node={node} />);
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});

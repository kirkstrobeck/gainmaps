"use client";

import { useEffect, useState, type RefObject } from "react";

export function useNearViewport(
  ref: RefObject<Element | null>,
  enabled: boolean,
  rootMargin = "200px",
): boolean {
  const [near, setNear] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    if (near) return;
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setNear(true);
    }, { rootMargin });
    io.observe(node);
    return () => io.disconnect();
  }, [enabled, near, ref, rootMargin]);

  return near;
}

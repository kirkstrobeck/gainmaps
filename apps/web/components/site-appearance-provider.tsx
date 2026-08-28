"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

import {
  readSiteAppearance,
  subscribeSiteAppearance,
  type SiteAppearance,
} from "@/lib/site-appearance";

const SiteAppearanceContext = createContext<SiteAppearance>({ mode: "dark", ultra: "on" });

export function SiteAppearanceProvider({
  initial,
  children,
}: {
  initial: SiteAppearance;
  children: ReactNode;
}) {
  /* v8 ignore next */
  const appearance = useSyncExternalStore(subscribeSiteAppearance, readSiteAppearance, () => initial);
  return (
    <SiteAppearanceContext.Provider value={appearance}>{children}</SiteAppearanceContext.Provider>
  );
}

export function useSiteAppearance(): SiteAppearance {
  return useContext(SiteAppearanceContext);
}

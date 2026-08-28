"use client";
import Giscus from "@giscus/react";

import { useSiteAppearance } from "@/components/site-appearance-provider";

export function CommunityComments() {
  const { mode } = useSiteAppearance();
  return (
    <Giscus
      repo="kirkstrobeck/gainmaps.com"
      repoId="REPO_ID"
      category="General"
      categoryId="CATEGORY_ID"
      mapping="pathname"
      reactionsEnabled="1"
      emitMetadata="0"
      inputPosition="top"
      theme={mode === "light" ? "light" : "dark"}
      lang="en"
    />
  );
}

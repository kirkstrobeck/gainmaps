import type { Metadata } from "next";
import { Suspense } from "react";

import { TextPageClient } from "@/app/text/client";

export const metadata: Metadata = {
  title: "Ultra text demo · Gainmaps",
  description: "Drag the slider to push text past SDR reference white on an HDR display.",
  alternates: { canonical: "/text" },
  openGraph: { type: "website", url: "/text" },
};

export default function Base() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <TextPageClient />
    </Suspense>
  );
}

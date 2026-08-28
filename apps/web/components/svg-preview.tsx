"use client";

import { useEffect, useState } from "react";

import { previewSvgMarkup } from "@/lib/svg-raster";
import { cn } from "@/lib/utils";

export function SvgPreview({
  file,
  className,
}: {
  file: File;
  className?: string;
}) {
  const [markup, setMarkup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    file
      .text()
      .then((text) => {
        /* v8 ignore next */
        if (abort.signal.aborted) return;
        setMarkup(previewSvgMarkup(text));
        setError(null);
      })
      .catch((reason: unknown) => {
        /* v8 ignore next */
        if (abort.signal.aborted) return;
        setMarkup(null);
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => abort.abort();
  }, [file]);

  if (error) {
    return <p className="text-center text-sm text-[var(--muted)]">{error}</p>;
  }
  if (!markup) {
    return <p className="text-center text-sm text-[var(--muted)]">Loading SVG…</p>;
  }

  return (
    <div
      className={cn(
        "preview-svg grid h-full w-full max-h-full max-w-full place-items-center [&_svg]:h-full [&_svg]:w-full",
        className,
      )}
      // User-selected local SVG; scripts and inline handlers are stripped in previewSvgMarkup.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

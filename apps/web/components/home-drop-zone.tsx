"use client";

import { UploadFileIcon as FileUploadFilled } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { UltraIcon } from "@/components/ultra-icon";
import { enqueueFiles } from "@/lib/file-queue";
import { ANALYTICS_EVENTS, summarizeFiles, track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/svg+xml",
];

export const ACCEPTED_EXT = /\.(png|jpe?g|webp|avif|gif|heic|heif|svg)$/i;

function filterFiles(list: FileList | File[]): File[] {
  return Array.from(list).filter(
    (file) => ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXT.test(file.name),
  );
}

interface HomeDropZoneProps {
  label?: string;
}

export function HomeDropZone({ label }: HomeDropZoneProps = {}) {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | File[], source = "home_drop_zone") => {
      const allFiles = Array.from(files);
      const valid = filterFiles(allFiles);
      if (!valid.length) {
        track(ANALYTICS_EVENTS.converterFilesRejected, {
          ...summarizeFiles(allFiles),
          source,
        });
        return;
      }
      track(ANALYTICS_EVENTS.converterHomeFilesSelected, {
        ...summarizeFiles(valid),
        rejected_count: allFiles.length - valid.length,
        source,
        destination: "/convert",
      });
      enqueueFiles(valid);
      router.push("/convert");
    },
    [router],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragActive(false);
      handleFiles(event.dataTransfer.files, "home_drop_zone_drop");
    },
    [handleFiles],
  );

  return (
    <section
      className={cn(
        "home-drop-zone grid w-full place-items-center gap-5 rounded-[calc(var(--radius)*1.5)] border bg-[color-mix(in_srgb,var(--accent)_5%,var(--panel))] p-10 transition-[transform,box-shadow,border-color,background-color] duration-200",
        dragActive
          ? "scale-[1.015] border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_13%,var(--panel))] shadow-[0_0_0_5px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
          : "border-[color-mix(in_srgb,var(--accent)_30%,var(--border))]",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      {label && (
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          {label}
        </p>
      )}
      <UltraIcon size={48}>
        <FileUploadFilled />
      </UltraIcon>

      <div className="grid gap-1.5 text-center">
        <p className="text-base font-semibold text-[var(--foreground)]">
          {dragActive ? "Release to convert" : "Drop an image"}
        </p>
        <p className="text-[11px] tracking-[0.06em] text-[var(--muted)]">
          JPEG · PNG · WebP · AVIF · HEIC · SVG
        </p>
      </div>

      <label className="cursor-pointer rounded-[var(--radius)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent)] has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--background)]">
        Choose files
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.avif,.gif,.heic,.heif,.svg,image/*"
          multiple
          onChange={(event) =>
            event.currentTarget.files && handleFiles(event.currentTarget.files, "home_drop_zone_picker")
          }
        />
      </label>
    </section>
  );
}

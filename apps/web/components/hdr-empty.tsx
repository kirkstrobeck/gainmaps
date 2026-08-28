"use client";

import {
  UploadFileIcon as FileUploadFilled,
  LockIcon as LockFilled,
} from "@/components/icons";
import type { DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { InstallSwitcher } from "@/components/install-switcher";
import { UltraWord } from "@/components/ultra-word";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";
import { cn } from "@/lib/utils";

interface HdrEmptyProps {
  addFiles: (files: FileList | File[], source?: string) => void;
  dragActive: boolean;
  dropHandlers: {
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: () => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
}

export function HdrEmpty({ addFiles, dragActive, dropHandlers }: HdrEmptyProps) {
  return (
    <section
      {...dropHandlers}
      className={cn(
        "mx-auto grid h-[calc(100dvh-4rem)] w-full max-w-7xl place-items-center overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8",
        dragActive && "bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]",
      )}
    >
      <div className="grid max-h-full w-full max-w-5xl gap-5 text-center">
        <div
          className={cn(
            "relative grid min-h-[min(520px,calc(100dvh-9rem))] overflow-hidden rounded-[calc(var(--radius)*1.5)] border-2 border-dashed border-[color-mix(in_srgb,var(--foreground)_24%,var(--border))] bg-[var(--panel)] p-5 shadow-sm transition sm:p-8",
            dragActive && "scale-[0.99] border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--panel))]",
          )}
        >
          <div className="grid place-items-center">
            <div className="grid max-w-3xl gap-5">
              <div className="mx-auto flex size-16 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] shadow-sm [@media(max-height:680px)]:hidden">
                <FileUploadFilled aria-hidden size={32} />
              </div>
              <div>
                <p className="mx-auto mb-4 flex max-w-max items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
                  <LockFilled aria-hidden size={14} />
                  Privacy: These files do not go anywhere.
                </p>
                <h1 className="font-display mx-auto max-w-4xl text-4xl font-bold leading-[1.02] tracking-normal text-[var(--foreground)] sm:text-5xl lg:text-6xl">
                  <UltraWord text="Drop images here to make them HDR." typeClassName="font-display mx-auto max-w-4xl text-4xl font-bold leading-[1.02] tracking-normal sm:text-5xl lg:text-6xl" intensity={TEXT_ULTRA_INTENSITY} />
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                  Processed 100% in your browser by a service worker. Nothing leaves. Compare the output, then download.
                </p>
              </div>
              <div className="mx-auto flex flex-wrap items-center justify-center gap-3">
                <Button asChild>
                  <label>
                    <FileUploadFilled aria-hidden size={18} />
                    Choose files
                    <input
                      className="sr-only"
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.avif,.gif,.heic,.heif,.svg,image/*"
                      multiple
                      onChange={(event) => event.currentTarget.files && addFiles(event.currentTarget.files, "converter_empty_picker")}
                    />
                  </label>
                </Button>
                <span className="text-[11px] tracking-[0.06em] text-[var(--muted)]">
                  JPEG · PNG · WebP · AVIF · GIF · HEIC · SVG
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 text-sm text-[var(--muted)]">
          <span>Or batch-encode from the terminal:</span>
          <InstallSwitcher surface="converter_empty" />
        </div>
      </div>
    </section>
  );
}

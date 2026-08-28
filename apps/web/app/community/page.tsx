import type { Metadata } from "next";
import { ArrowForwardIcon as ArrowRightFilled, ForumIcon as CommentFilled } from "@/components/icons";
import { UltraWord } from "@/components/ultra-word";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";

import { CommunityComments } from "@/components/community-comments";
import { PageChrome } from "@/components/page-chrome";
import { UltraIcon } from "@/components/ultra-icon";

export const metadata: Metadata = {
  title: "Community · Gainmaps",
  description:
    "Questions, discoveries, edge cases, and feedback about gain map images — a shared thread for format quirks, display reports, and anything you found in the wild.",
  alternates: { canonical: "/community" },
  openGraph: { type: "website", url: "/community" },
};

const LINKS = [
  { href: "/convert", label: "Convert a photo" },
  { href: "/photos",  label: "Browse HDR photos" },
  { href: "/logos",   label: "Browse logos" },
  { href: "/docs",    label: "Read the docs" },
];

export default function Base() {
  return (
    <main>
      <PageChrome />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-12 sm:px-6 lg:px-8">

        <header className="border-b border-[var(--border)] pb-10">
          <div className="mb-4 flex items-center gap-3">
            <span
              className="flex size-8 items-center justify-center rounded-[calc(var(--radius)-2px)] text-[var(--accent)]"
              style={{ background: "color-mix(in srgb, var(--accent) 10%, var(--panel))" }}
              aria-hidden
            >
              <UltraIcon size={16}><CommentFilled /></UltraIcon>
            </span>
            <p className="text-sm font-medium uppercase tracking-[0.1em] text-[var(--muted)]">
              Community
            </p>
          </div>

          <h1 className="font-display text-4xl font-bold leading-[1.03] tracking-normal sm:text-5xl">
            <UltraWord text="Community" typeClassName="font-display text-4xl font-bold leading-[1.03] tracking-normal sm:text-5xl" intensity={TEXT_ULTRA_INTENSITY} />
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Questions, discoveries, edge cases, and feedback, all in one thread. If you found a
            format that behaves unexpectedly, or a display where the gain map really shines, this is
            the right place.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] transition hover:opacity-75"
              >
                {label}
                <ArrowRightFilled aria-hidden size={13} />
              </a>
            ))}
          </div>
        </header>

        <div className="pt-10">
          <CommunityComments />
        </div>
      </div>
    </main>
  );
}

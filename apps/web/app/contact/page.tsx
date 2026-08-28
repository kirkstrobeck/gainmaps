import type { Metadata } from "next";
import { PageChrome } from "@/components/page-chrome";
import { UltraWord } from "@/components/ultra-word";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";

export const metadata: Metadata = {
  title: "Contact · Gainmaps",
  description: "Get in touch with the Gainmaps project via GitHub Issues or email.",
  alternates: { canonical: "/contact" },
  openGraph: { type: "website", url: "/contact" },
};

export default function ContactPage() {
  return (
    <main>
      <PageChrome />
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold tracking-normal">
          <UltraWord text="Contact" typeClassName="font-display text-4xl font-bold tracking-normal" intensity={TEXT_ULTRA_INTENSITY} />
        </h1>
        <div className="mt-8 grid gap-6 text-base leading-7 text-[var(--muted)]">
          <p>
            For bugs, feature requests, and questions, open an issue on GitHub:
          </p>
          <p>
            <a
              href="https://github.com/kirkstrobeck/gainmaps.com/issues"
              className="text-[var(--accent)] underline underline-offset-2"
              rel="noopener noreferrer"
              target="_blank"
            >
              github.com/kirkstrobeck/gainmaps.com/issues →
            </a>
          </p>
          <p>
            For direct enquiries, email{" "}
            <a href="mailto:kirk@strobeck.com" className="text-[var(--accent)] underline underline-offset-2">
              kirk@strobeck.com
            </a>.
          </p>
        </div>
      </div>
    </main>
  );
}

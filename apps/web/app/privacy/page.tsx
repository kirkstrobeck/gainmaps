import type { Metadata } from "next";
import { PageChrome } from "@/components/page-chrome";
import { UltraWord } from "@/components/ultra-word";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";

export const metadata: Metadata = {
  title: "Privacy · Gainmaps",
  description: "Gainmaps privacy policy: cookies, analytics, and what data is collected.",
  alternates: { canonical: "/privacy" },
  openGraph: { type: "website", url: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main>
      <PageChrome />
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold tracking-normal">
          <UltraWord text="Privacy" typeClassName="font-display text-4xl font-bold tracking-normal" intensity={TEXT_ULTRA_INTENSITY} />
        </h1>
        <div className="mt-8 grid gap-8 text-base leading-7 text-[var(--muted)]">
          <section>
            <h2 className="font-display text-xl font-semibold tracking-normal text-[var(--foreground)]">Cookies</h2>
            <ul className="mt-4 grid gap-3 list-disc ml-5">
              <li>
                <strong className="text-[var(--foreground)]">last-photo</strong> — stores the slug of the
                last hero photo shown on the homepage. Purpose: avoid repeating the same photo on reload.
                Max-Age: 31536000 (1 year). Not shared with third parties.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">site-mode</strong> — stores your light/dark
                theme preference. Session-like, no expiry set.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">site-ultra</strong> — stores your Ultra HDR
                preference. Session-like, no expiry set.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">site-intensity</strong> — stores your Ultra
                intensity slider value. Session-like, no expiry set.
              </li>
            </ul>
          </section>
          <section>
            <h2 className="font-display text-xl font-semibold tracking-normal text-[var(--foreground)]">Analytics</h2>
            <p className="mt-4">
              PostHog analytics is proxied via{" "}
              <code className="rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono text-sm text-[var(--foreground)]">/ingest/*</code>{" "}
              on this domain. No personally identifiable information is collected or sold.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

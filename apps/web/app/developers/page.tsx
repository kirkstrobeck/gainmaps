import type { Metadata } from "next";
import { ArrowForwardIcon as ArrowRightFilled } from "@/components/icons";
import { PageChrome } from "@/components/page-chrome";
import { UltraWord } from "@/components/ultra-word";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";
import { DevelopersCLISection } from "@/components/developers/cli-section";
import { DevelopersAgentSkillSection } from "@/components/developers/agent-skill-section";
import { DevelopersAPISection } from "@/components/developers/api-section";

export const metadata: Metadata = {
  title: "Developers · Gainmaps",
  description: "CLI docs, agent skill, and library reference for gainmaps.",
  alternates: { canonical: "/developers" },
  openGraph: { type: "website", url: "/developers" },
};

const sections = [
  ["CLI", "#cli"],
  ["Agent Skill", "#agent-skill"],
  ["Library", "#library"],
];

export default function DevelopersPage() {
  return (
    <main>
      <PageChrome />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:px-8">

        {/* Sidebar TOC */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav className="ultra-surface grid gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-2 text-sm">
            {sections.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="flex items-center justify-between rounded-[calc(var(--radius)-2px)] px-3 py-2 text-[var(--muted)] transition hover:bg-[var(--panel-strong)] hover:text-[var(--foreground)]"
              >
                {label}
                <ArrowRightFilled aria-hidden size={14} />
              </a>
            ))}
          </nav>

          {/* Quick links */}
          <div className="mt-4 grid gap-1 text-sm">
            <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--muted)]">
              Also see
            </p>
            {[
              ["/docs", "Format docs"],
              ["/text", "Ultra text demo"],
              ["/convert", "Browser converter"],
              ["/openapi.json", "OpenAPI spec"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="flex items-center justify-between rounded-[calc(var(--radius)-2px)] px-3 py-2 text-[var(--accent)] transition hover:bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]"
              >
                {label}
                <ArrowRightFilled aria-hidden size={14} />
              </a>
            ))}
          </div>
        </aside>

        {/* Main article */}
        <article className="min-w-0">
          <header className="border-b border-[var(--border)] pb-10">
            <p className="mb-4 text-sm font-medium text-[var(--muted)]">Developer reference</p>
            <h1 className="font-display max-w-4xl text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl">
              <UltraWord
                text="Developers"
                typeClassName="font-display text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl"
                intensity={TEXT_ULTRA_INTENSITY}
              />
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-[var(--muted)]">
              Gainmaps ships a CLI for batch encoding, an agent skill for Ultra HDR text effects, and a
              TypeScript library for programmatic encoding. All three are open source.
            </p>
          </header>

          <DevelopersCLISection />
          <DevelopersAgentSkillSection />
          <DevelopersAPISection />
        </article>
      </div>
    </main>
  );
}

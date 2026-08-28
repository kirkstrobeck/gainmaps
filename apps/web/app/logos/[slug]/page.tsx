// Server-render on request — static prerender fails in this container due to
// a React module null issue in the server bundle during SSG.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowBackIcon as ArrowLeftFilled, ArrowForwardIcon as ArrowRightFilled } from "@/components/icons";
import { UltraWord } from "@/components/ultra-word";
import { TEXT_ULTRA_INTENSITY } from "@/lib/text-ultra";

import { LogoPair } from "@/components/logo-pair";
import { PageChrome } from "@/components/page-chrome";
import { UltraIcon } from "@/components/ultra-icon";
import { COMPANIES, companyBySlug } from "@/lib/logos/companies";

type Params = { params: Promise<{ slug: string }> };

const BGB_2025_RANKS = 100;

export function generateStaticParams(): { slug: string }[] {
  return COMPANIES.map((company) => ({ slug: company.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const company = companyBySlug((await params).slug);
  if (!company) return { title: "Logos · Gainmaps" };

  return {
    title: `${company.name} · Logos · Gainmaps`,
    description: `The ${company.name} brand mark as a standard SVG and as a gain map.`,
  };
}

export default async function Base({ params }: Params) {
  const company = companyBySlug((await params).slug);
  if (!company) notFound();

  const neighbours = surrounding(company.slug);

  return (
    <main>
      <PageChrome />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <a
          className="inline-flex items-center gap-2 rounded-[var(--radius)] px-2 py-1 text-sm text-[var(--muted)] transition hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] -ml-2"
          href="/logos"
        >
          <UltraIcon size={14}>
            <ArrowLeftFilled />
          </UltraIcon>
          All logos
        </a>

        <header className="mt-6 border-b border-[var(--border)] pb-8">
          <p className="mb-3 font-mono text-sm text-[var(--muted)]">{ranking(company.rank)}</p>
          <h1 className="font-display text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl">
            <UltraWord text={company.name} typeClassName="font-display text-5xl font-bold leading-[1.03] tracking-normal sm:text-6xl" intensity={TEXT_ULTRA_INTENSITY} />
          </h1>
        </header>

        {/* Logo proof — no heavy card chrome */}
        <section className="mt-10">
          <LogoPair company={company} size="detail" />
          <p className="mt-6 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Left: the source vector. Right: the same mark rasterized and encoded as an Ultra HDR
            gain map at 0.5 boost. JPEG has no alpha channel, so the SVG masks the opaque
            matte. Only the mark's own pixels survive, with the checkerboard behind them.
          </p>
        </section>

        {/* File facts */}
        <dl className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--border)] text-sm sm:grid-cols-2">
          <Fact label="Vector" value={company.svgPath} href={company.svgPath} />
          <Fact label="Gain map" value={company.gainmapPath} href={company.gainmapPath} />
        </dl>

        {/* Neighbour navigation */}
        <nav
          className="mt-8 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-6 text-sm"
          aria-label="Logo navigation"
        >
          <NeighbourLink company={neighbours.previous} direction="prev" />
          <NeighbourLink company={neighbours.next} direction="next" />
        </nav>
      </div>
    </main>
  );
}

function Fact({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="bg-[var(--panel)] px-4 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-1 truncate font-mono text-[12px]">
        <a
          className="transition hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
          href={href}
        >
          {value}
        </a>
      </dd>
    </div>
  );
}

function NeighbourLink({
  company,
  direction,
}: {
  company: { slug: string; name: string } | undefined;
  direction: "prev" | "next";
}) {
  if (!company) return <span />;

  const isPrev = direction === "prev";
  return (
    <a
      href={`/logos/${company.slug}`}
      className="inline-flex max-w-[48%] items-center gap-2 rounded-[var(--radius)] px-2 py-1 text-[var(--muted)] transition hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      {isPrev && (
        <UltraIcon size={14} className="shrink-0">
          <ArrowLeftFilled />
        </UltraIcon>
      )}
      <span className="truncate text-xs">{company.name}</span>
      {!isPrev && (
        <UltraIcon size={14} className="shrink-0">
          <ArrowRightFilled />
        </UltraIcon>
      )}
    </a>
  );
}

function ranking(rank: number): string {
  if (rank > BGB_2025_RANKS) return "Interbrand Best Global Brands 2024";
  return `#${rank} · Interbrand Best Global Brands 2025`;
}

function surrounding(slug: string) {
  const index = COMPANIES.findIndex((company) => company.slug === slug);
  return { previous: COMPANIES[index - 1], next: COMPANIES[index + 1] };
}

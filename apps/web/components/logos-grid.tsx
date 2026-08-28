"use client";

import { useState } from "react";

import { LogoPair } from "@/components/logo-pair";
import type { Company } from "@/lib/logos/companies";

const PAGE_SIZE = 24;

export function LogosGrid({ companies }: { companies: readonly Company[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = companies.slice(0, visible);
  const remaining = companies.length - visible;

  return (
    <>
      <ul className="mt-10 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((company) => (
          <li key={company.slug} className="grid gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] p-4 transition hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--border))]">
            <LogoPair company={company} size="card" />
            <div className="flex items-baseline justify-between px-0.5">
              <a
                href={`/logos/${company.slug}`}
                className="text-xs font-semibold text-[var(--foreground)] transition hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {company.name}
              </a>
              <span className="font-mono text-[10px] text-[var(--muted)]">
                #{company.rank}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => Math.min(v + PAGE_SIZE, companies.length))}
            className="rounded-[var(--radius)] border border-[var(--border)] px-6 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Show more ({remaining} remaining)
          </button>
        </div>
      )}
    </>
  );
}

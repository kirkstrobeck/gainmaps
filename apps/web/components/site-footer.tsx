import Link from "next/link";
import { FOOTER_LINKS } from "@/lib/nav";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const LINK_CLASS = `text-xs text-[var(--muted)] transition hover:text-[var(--accent)] ${FOCUS}`;

const CREDIT_HREF = "https://www.linkedin.com/in/kirkstrobeck";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] py-4 text-center">
      <nav
        aria-label="Secondary"
        className="mb-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
      >
        {FOOTER_LINKS.map(({ href, label }) => (
          <Link key={href} href={href} className={LINK_CLASS}>
            {label}
          </Link>
        ))}
      </nav>
      <a href={CREDIT_HREF} className={LINK_CLASS}>
        Made by Kirk Strobeck
      </a>
    </footer>
  );
}

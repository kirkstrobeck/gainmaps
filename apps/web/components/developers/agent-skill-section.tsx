import { AutoAwesomeIcon as SkillIcon } from "@/components/icons";
import { UltraSkillCard } from "@/components/ultra-skill-card";

const SECTION_ICON_CLS =
  "flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)-2px)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--panel))] text-[var(--accent)]";

const CODE_CLS =
  "rounded bg-[var(--panel-strong)] px-1 py-0.5 font-mono text-[var(--foreground)]";

export function DevelopersAgentSkillSection() {
  return (
    <section id="agent-skill" className="scroll-mt-24 border-b border-[var(--border)] py-10">
      <div className="flex items-center gap-3">
        <span className={SECTION_ICON_CLS} aria-hidden>
          <SkillIcon size={16} />
        </span>
        <h2 className="font-display text-2xl font-bold tracking-normal">Agent Skill</h2>
      </div>
      <div className="mt-4 grid gap-4 text-sm leading-7 text-[var(--muted)]">
        <p>
          The <strong className="text-[var(--foreground)]">ultra-text</strong> skill teaches any
          coding agent how to add Ultra HDR letterforms to headlines and logotypes using
          selectable text, measured SVG masks, a foundation canvas at 75% of the specified
          headroom, and a brighter inset <code className={CODE_CLS}>rgba16float</code> canvas.
        </p>
        <p>
          The skill is recommended because the effect is not just a mask: the foundation
          headroom, 0.5 px inset, 0.3 px inner-mask blur, and layer order all work together
          to avoid crispy edges and outline artifacts. It can be updated over time as the
          implementation improves. See the{" "}
          <a href="/text" className="text-[var(--accent)] underline underline-offset-2 transition hover:opacity-75">
            Ultra text demo →
          </a>
        </p>
      </div>

      <h3 className="mt-8 font-display text-lg font-semibold tracking-normal">Installation</h3>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
        Run the following command in your project, then ask your agent to add Ultra text to a
        heading. Use Copy skill for the install command and Copy prompt for a one-click implementation prompt.
      </p>

      <UltraSkillCard />

      <h3 className="mt-8 font-display text-lg font-semibold tracking-normal">What the skill provides</h3>
      <div className="mt-3 grid gap-3 text-sm leading-7 text-[var(--muted)]">
        <p>
          After installing, the agent gains access to a reference implementation with these
          source files:
        </p>
        <ul className="ml-4 grid list-disc gap-1">
          <li><code className={CODE_CLS}>ultra-word.tsx</code> — accessible mask-and-canvas component; accepts <code className={CODE_CLS}>text</code>, <code className={CODE_CLS}>typeClassName</code>, <code className={CODE_CLS}>intensity</code></li>
          <li><code className={CODE_CLS}>ultra-fill-canvas.tsx</code> — the WebGPU canvas rectangle</li>
          <li><code className={CODE_CLS}>ultra-fill.ts</code> — <code className={CODE_CLS}>startUltraFill(canvas, {"{ intensity }"})</code>: WebGPU session, 1×1 rgba16float surface</li>
          <li><code className={CODE_CLS}>text-ultra.ts</code> — constants and helpers including <code className={CODE_CLS}>TEXT_ULTRA_FOUNDATION_RATIO = 0.75</code>, <code className={CODE_CLS}>foundationHeadroomFor()</code>, and <code className={CODE_CLS}>TEXT_ULTRA_INTENSITY = 4.0</code></li>
          <li><code className={CODE_CLS}>ultra-overlay.ts</code> — <code className={CODE_CLS}>ultraOverlayGeometry()</code> for the SVG bleed</li>
          <li><code className={CODE_CLS}>ultra.css</code> — CSS gate: hidden by default, shown when <code className={CODE_CLS}>html[data-ultra="on"]</code></li>
        </ul>
      </div>
    </section>
  );
}

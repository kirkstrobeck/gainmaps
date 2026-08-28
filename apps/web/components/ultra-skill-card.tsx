import { CopyButton } from "@/components/copy-button";
import { ULTRA_HEADING_PROMPT } from "@/lib/ultra-prompt";

type UltraSkillCardProps = {
  hideHeading?: boolean;
};

export function UltraSkillCard({ hideHeading }: UltraSkillCardProps = {}) {
  return (
    <div className="mt-10 min-w-0 max-w-full">
      {!hideHeading && (
        <>
          <h3 className="font-display text-xl font-semibold">Add Ultra text to your project</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Recommended path: install the agent skill so your project can pick up future Ultra text refinements over time. It teaches any coding agent how to add Ultra HDR letterforms to headlines and logotypes.
          </p>
        </>
      )}
      <div className="mt-4 grid min-w-0 max-w-md grid-cols-2 gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] px-3 py-3 sm:flex sm:items-center sm:px-4 sm:py-2">
        <code className="col-span-2 min-w-0 truncate font-mono text-xs sm:flex-1 sm:text-sm">npx skills add kirkstrobeck/gainmaps</code>
        <CopyButton
          text="npx skills add kirkstrobeck/gainmaps"
          label="Copy skill"
          className="justify-center sm:ml-2 sm:shrink-0"
          analyticsLabel="ultra_skill_install"
          analyticsProperties={{ surface: "ultra_skill_card" }}
        />
        <CopyButton
          text={ULTRA_HEADING_PROMPT}
          label="Copy prompt"
          className="justify-center sm:ml-2 sm:shrink-0"
          analyticsLabel="ultra_text_prompt"
          analyticsProperties={{ surface: "ultra_skill_card" }}
        />
      </div>
      <p className="mt-2 max-w-md text-xs leading-5 text-[var(--muted)]">
        The skill is the recommended path because this rendering stack has edge-treatment details that can be updated without retyping the implementation by hand.
        {" "}
        <a
          href="https://github.com/kirkstrobeck/gainmaps/tree/main/skills/ultra-text"
          className="underline underline-offset-2 hover:text-[var(--accent)] transition"
          target="_blank"
          rel="noopener noreferrer"
        >
          View skill source on GitHub →
        </a>
      </p>
    </div>
  );
}

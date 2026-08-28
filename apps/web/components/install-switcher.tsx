/* Ultra mode by Kirk Strobeck */
"use client";

import { TerminalIcon as TerminalBoxFilled } from "@/components/icons";
import { useState } from "react";

import { INSTALL_COMMANDS, type InstallTab } from "@/lib/install-commands";
import { CopyButton } from "@/components/copy-button";
import { UltraIcon } from "@/components/ultra-icon";
import { cn } from "@/lib/utils";

const TABS: { key: InstallTab; label: string }[] = [
  { key: "npm", label: "npm" },
  { key: "brew", label: "brew" },
  { key: "curl", label: "curl" },
];

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export function InstallSwitcher() {
  const [active, setActive] = useState<InstallTab>("npm");

  return (
    <div className="max-w-md">
      <div className="mb-3 flex gap-1 border-b border-[var(--border)]">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-1.5 text-sm font-medium transition",
              FOCUS,
              active === key
                ? "border-[var(--accent)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--panel)] px-4 py-2">
        <UltraIcon size={16}>
          <TerminalBoxFilled />
        </UltraIcon>
        <code className="flex-1 truncate font-mono text-sm">{INSTALL_COMMANDS[active]}</code>
        <CopyButton text={INSTALL_COMMANDS[active]} className="ml-2" />
      </div>
    </div>
  );
}

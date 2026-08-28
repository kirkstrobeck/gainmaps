"use client";

import { useEffect, useRef, useState } from "react";
import { registerDisplayCheckSetter } from "@/lib/display-check-store";

const STORAGE_KEY = "display-check-dismissed";
const EXAMPLE_BASE_URL = "https://icquwwyymqnvhcpufxje.supabase.co/storage/v1/object/public/static/gainmaps.com/display-check/examples";
const EXAMPLES = [
  { src: `${EXAMPLE_BASE_URL}/example-1.jpg`, alt: "Photo showing an HDR gain map effect on a display" },
  { src: `${EXAMPLE_BASE_URL}/example-2.jpg`, alt: "Close-up photo demonstrating brighter HDR highlights" },
  { src: `${EXAMPLE_BASE_URL}/example-3.jpg`, alt: "Photo showing how the Ultra effect appears on compatible hardware" },
] as const;

type Answer = "question" | "yes" | "no";

export function DisplayCheckModal() {
  const [visible, setVisible] = useState(false);
  const [answer, setAnswer] = useState<Answer>("question");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    registerDisplayCheckSetter((next) => {
      if (next) setAnswer("question");
      setVisible(next);
    });
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    previousFocusRef.current = document.activeElement;
    document.body.style.overflow = "hidden";
    buttonRef.current?.focus();

    return () => {
      document.body.style.overflow = "";
      /* v8 ignore next */
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [visible, answer]);

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") dismiss();
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      aria-hidden="false"
      onClick={dismiss}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="display-check-title"
        className="relative max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="display-check-title"
          className="text-center text-xl font-semibold leading-tight text-[var(--foreground)]"
        >
          {answer === "yes" ? "Yes, you can see it." : answer === "no" ? "No, you can't." : "Can you see the symbol?"}
        </h2>

        {answer === "question" ? (
          <>
            <div className="my-5 flex justify-center">
              <img
                src="/display-check/test.jpg"
                className="gainmap-image aspect-square w-48 rounded-[var(--radius)] border border-[var(--border)] object-cover"
                width={200}
                height={200}
                alt="HDR display test with a hidden symbol inside a bright square"
              />
            </div>
            <p className="mx-auto max-w-sm text-center text-sm leading-6 text-[var(--muted)]">
              If the symbol is visible inside the bright square, this display can show the Ultra effect.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                ref={buttonRef}
                type="button"
                onClick={() => setAnswer("yes")}
                className="rounded-[calc(var(--radius)-2px)] bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setAnswer("no")}
                className="rounded-[calc(var(--radius)-2px)] border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm font-bold text-[var(--foreground)] transition hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] hover:bg-[var(--panel-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                No
              </button>
            </div>
          </>
        ) : null}

        {answer === "yes" ? (
          <div className="mt-5 space-y-5 text-center">
            <p className="text-sm leading-6 text-[var(--muted)]">
              This display can show brightness above SDR white, so Ultra text and gain map images should read as brighter than normal white.
            </p>
            <button
              ref={buttonRef}
              onClick={dismiss}
              className="block w-full rounded-[calc(var(--radius)-2px)] bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-bold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Done
            </button>
          </div>
        ) : null}

        {answer === "no" ? (
          <div className="mt-5 space-y-5">
            <p className="text-center text-sm leading-6 text-[var(--muted)]">
              It is hard to show what this display cannot show. That is why this feature is frustrating to explain: on the wrong screen, the extra brightness collapses back into ordinary white. These photos help demonstrate the effect.
            </p>
            <div className="grid grid-cols-3 gap-2" aria-label="Photos that help show the Ultra effect">
              {EXAMPLES.map((example) => (
                <img
                  key={example.src}
                  src={example.src}
                  alt={example.alt}
                  width={180}
                  height={180}
                  className="aspect-square w-full rounded-[calc(var(--radius)-2px)] border border-[var(--border)] object-cover"
                />
              ))}
            </div>
            <button
              ref={buttonRef}
              onClick={dismiss}
              className="block w-full rounded-[calc(var(--radius)-2px)] bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-bold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Done
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

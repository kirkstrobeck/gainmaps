import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value: number; className?: string }) {
  const clamped = Math.min(Math.max(value, 0), 100);

  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-[var(--panel-strong)]", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <div
        className="h-full rounded-full bg-[var(--foreground)] transition-[width] duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

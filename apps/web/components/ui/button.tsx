import { Slot } from "@radix-ui/react-slot";
import { type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-[var(--foreground)] text-[var(--background)] hover:opacity-90",
  secondary:
    "border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] hover:bg-[var(--panel-strong)]",
  ghost:
    "border-transparent bg-transparent text-[var(--foreground)] hover:bg-[var(--panel-strong)]",
};

export function Button({
  asChild,
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] border px-4 text-sm font-medium transition active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        className,
      )}
      type={asChild ? undefined : type}
      {...props}
    />
  );
}

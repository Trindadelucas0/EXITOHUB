import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary:
    "bg-brand text-white shadow-brand-sm hover:bg-brand-hover disabled:bg-line disabled:text-ink-muted disabled:shadow-none",
  secondary:
    "bg-white text-ink border border-line-strong hover:bg-paper-sunken disabled:opacity-50",
  ghost: "bg-transparent text-ink hover:bg-paper-sunken disabled:opacity-50",
  danger: "bg-status-bad text-white hover:opacity-90 disabled:opacity-50",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

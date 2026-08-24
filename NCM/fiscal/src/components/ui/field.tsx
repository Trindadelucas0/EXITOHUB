import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  compact?: boolean;
};

export function Field({ label, error, id, className = "", compact = false, ...props }: Props) {
  const fieldId = id ?? props.name;
  return (
    <div className={compact ? "min-w-0 w-full" : "grid gap-1.5"}>
      <label htmlFor={fieldId} className={compact ? "sr-only" : "text-sm font-medium text-ink"}>
        {label}
      </label>
      <input
        id={fieldId}
        className={`min-h-11 w-full rounded-md border border-line-strong bg-white px-3 text-base text-ink placeholder:text-ink-muted md:text-sm ${className}`}
        {...props}
      />
      {error ? <p className="text-sm text-status-bad">{error}</p> : null}
    </div>
  );
}

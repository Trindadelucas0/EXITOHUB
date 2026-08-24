type Variant = "success" | "error" | "warn";

const VARIANTS: Record<Variant, string> = {
  success: "border-brand bg-brand-soft text-status-ok shadow-brand-sm",
  error: "border-status-bad bg-status-bad-bg text-status-bad",
  warn: "border-line-strong bg-status-warn-bg text-status-warn",
};

export function Notice({
  variant,
  children,
  className = "",
}: {
  variant: Variant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role={variant === "error" ? "alert" : "status"}
      className={`rounded-md border-l-4 px-3 py-2 text-sm font-medium ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </p>
  );
}

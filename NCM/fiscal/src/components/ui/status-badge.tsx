import type { StatusFiscal } from "@/src/lib/fiscal";

const MAP: Record<
  StatusFiscal,
  { label: string; className: string }
> = {
  CORRETO: {
    label: "Correto",
    className: "bg-brand-soft text-status-ok ring-1 ring-brand shadow-brand-sm",
  },
  DIVERGENTE: {
    label: "Divergente",
    className: "bg-status-bad-bg text-status-bad ring-1 ring-status-bad/40",
  },
  NECESSITA_ANALISE: {
    label: "Necessita análise",
    className: "bg-status-warn-bg text-status-warn ring-1 ring-line-strong/40",
  },
};

export function StatusBadge({ status }: { status: StatusFiscal }) {
  const item = MAP[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${item.className}`}
    >
      {item.label}
    </span>
  );
}

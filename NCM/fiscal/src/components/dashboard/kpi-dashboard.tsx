"use client";

import Link from "next/link";
import { BatchDiffPanel } from "@/src/components/product/batch-diff-panel";
import { BatchSelector } from "@/src/components/product/batch-selector";
import { useActiveBatch } from "@/src/components/product/use-active-batch";
import { EmptyState } from "@/src/components/ui/empty-state";
import { PageHeader } from "@/src/components/ui/page-header";

export function KpiDashboard({ companyName }: { companyName: string }) {
  const { batchId, onBatchChange, loteFromUrl, active, batchBooted } = useActiveBatch();

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker={companyName}
        title="Panorama do cadastro"
        description="Números da planilha ativa. A listagem fica em Consultar e Divergências."
      />
      <div className="max-w-xl">
        <BatchSelector preferredId={loteFromUrl} onChange={onBatchChange} />
      </div>
      {!batchBooted ? (
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {["Analisados", "Corretos", "Divergentes", "Análise"].map((label) => (
            <div key={label} className="rounded-lg border border-line bg-white p-4">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
              <dd className="mt-1 h-8 w-16 animate-pulse rounded bg-line" />
            </div>
          ))}
        </dl>
      ) : null}
      {batchBooted && !active ? (
        <EmptyState
          title="Nenhuma planilha importada"
          description="O panorama fica vazio até a importação de um arquivo desta empresa."
          actionHref="/importar"
          actionLabel="Importar cadastro"
        />
      ) : null}
      {active && batchId ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              label="Analisados"
              value={active.totalRows}
              href={`/consulta?lote=${encodeURIComponent(batchId)}`}
            />
            <Kpi
              label="Corretos"
              value={active.corretos}
              href={`/consulta?status=CORRETO&lote=${encodeURIComponent(batchId)}`}
              tone="ok"
            />
            <Kpi
              label="Divergentes"
              value={active.divergentes}
              href={`/divergencias?lote=${encodeURIComponent(batchId)}`}
              tone="bad"
            />
            <Kpi
              label="Análise"
              value={active.analise}
              href={`/consulta?status=NECESSITA_ANALISE&lote=${encodeURIComponent(batchId)}`}
            />
          </div>
          <BatchDiffPanel lote={batchId} />
        </>
      ) : null}
    </div>
  );
}

const KPI_TONES = {
  neutral: { card: "border-line bg-white hover:border-brand hover:shadow-brand-sm", value: "text-ink" },
  ok: {
    card: "border-brand border-l-4 bg-brand-soft shadow-brand-sm hover:shadow-brand",
    value: "text-status-ok",
  },
  bad: {
    card: "border-status-bad border-l-4 bg-status-bad-bg hover:shadow-panel",
    value: "text-status-bad",
  },
} as const;

function Kpi({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number;
  href: string;
  tone?: keyof typeof KPI_TONES;
}) {
  const style = KPI_TONES[tone];
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${style.card}`}
    >
      <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      <span className={`mt-1 block font-display text-xl tabular sm:text-2xl ${style.value}`}>{value}</span>
    </Link>
  );
}

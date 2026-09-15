"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BatchDiffPanel } from "@/src/components/product/batch-diff-panel";
import { BatchSelector, persistSelection } from "@/src/components/product/batch-selector";
import { useActiveBatch } from "@/src/components/product/use-active-batch";
import { EmptyState } from "@/src/components/ui/empty-state";
import { PageHeader } from "@/src/components/ui/page-header";
import { ncmApiUrl } from "@/src/lib/base-path";
import { statusPercents, type DashboardNcmRow, type DashboardSegmentoRow } from "@/src/lib/dashboard-metrics";
import { LoteSparkline } from "./lote-sparkline";
import { NcmRankBars } from "./ncm-rank-bars";
import { SegmentoRankBars } from "./segmento-rank-bars";
import { StatusDonut } from "./status-donut";

type BreakdownPayload = {
  totals: { total: number; corretos: number; divergentes: number; analise: number };
  ruleCount: number;
  treatedCount: number;
  untreatedAttention: number;
  topNcm: DashboardNcmRow[];
  segmento: { groups: DashboardSegmentoRow[] } | null;
  hasCadastro: boolean;
};

export function KpiDashboard({ companyName }: { companyName: string }) {
  const { batchId, batches, onBatchChange, loteFromUrl, active, batchBooted } = useActiveBatch();
  const [canWrite, setCanWrite] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownPayload | null>(null);
  const [chartsState, setChartsState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    fetch(ncmApiUrl("/api/auth/me"))
      .then((r) => r.json())
      .then((json) => setCanWrite(Boolean(json.data?.canWrite)))
      .catch(() => setCanWrite(false));
  }, []);

  useEffect(() => {
    if (!batchId) {
      setBreakdown(null);
      setChartsState("idle");
      return;
    }
    const controller = new AbortController();
    setChartsState("loading");
    fetch(ncmApiUrl(`/api/dashboard?lote=${encodeURIComponent(batchId)}`), { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Falha");
        setBreakdown(json.data as BreakdownPayload);
        setChartsState("ok");
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setChartsState("error");
      });
    return () => controller.abort();
  }, [batchId, retry]);

  const onSparklineSelect = useCallback(
    async (id: string) => {
      try {
        await persistSelection(id);
        onBatchChange(id, batches);
      } catch {
        onBatchChange(id, batches);
      }
    },
    [batches, onBatchChange],
  );

  const totals = active
    ? { total: active.totalRows, corretos: active.corretos, divergentes: active.divergentes, analise: active.analise }
    : breakdown?.totals;
  const pct = totals ? statusPercents(totals) : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker={companyName}
        title="Panorama do cadastro"
        description="Números e gráficos da planilha ativa. Clique nos cards ou nas barras para abrir a lista."
      />
      <div className="max-w-xl">
        <BatchSelector preferredId={loteFromUrl} syncId={batchId} onChange={onBatchChange} />
      </div>
      {!batchBooted ? (
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {["Analisados", "Corretos", "Divergentes", "Análise"].map((label) => (
            <div key={label} className="rounded-lg bg-white p-4 shadow-panel">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
              <dd className="mt-1 h-8 w-16 animate-pulse rounded bg-line" />
            </div>
          ))}
        </dl>
      ) : null}
      {batchBooted && !active ? (
        <EmptyState
          title="Nenhuma planilha importada"
          description={
            canWrite
              ? "O panorama fica vazio até a importação de um arquivo desta empresa."
              : "Ainda não há planilha importada. Peça ao administrador para importar o cadastro."
          }
          actionHref={canWrite ? "/importar" : undefined}
          actionLabel={canWrite ? "Importar cadastro" : undefined}
        />
      ) : null}
      {active && batchId && totals && pct ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              label="Analisados"
              value={totals.total}
              percent={pct.analisados}
              href={`/consulta?lote=${encodeURIComponent(batchId)}`}
            />
            <Kpi
              label="Corretos"
              value={totals.corretos}
              percent={pct.corretos}
              href={`/consulta?status=CORRETO&lote=${encodeURIComponent(batchId)}`}
              tone="ok"
            />
            <Kpi
              label="Divergentes"
              value={totals.divergentes}
              percent={pct.divergentes}
              href={`/divergencias?lote=${encodeURIComponent(batchId)}`}
              tone="bad"
            />
            <Kpi
              label="Análise"
              value={totals.analise}
              percent={pct.analise}
              href={`/consulta?status=NECESSITA_ANALISE&lote=${encodeURIComponent(batchId)}`}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi
              label="Tratados"
              value={breakdown?.treatedCount ?? 0}
              href={`/consulta?tratado=sim&lote=${encodeURIComponent(batchId)}`}
            />
            <Kpi
              label="A tratar"
              value={breakdown?.untreatedAttention ?? 0}
              href={`/divergencias?lote=${encodeURIComponent(batchId)}`}
              tone="bad"
            />
            <Kpi label="Regras na base" value={breakdown?.ruleCount ?? 0} href="/base-fiscal" />
          </div>
          {chartsState === "loading" || chartsState === "idle" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-48 animate-pulse rounded-lg bg-white shadow-panel" />
              <div className="h-48 animate-pulse rounded-lg bg-white shadow-panel" />
            </div>
          ) : null}
          {chartsState === "error" ? (
            <div className="rounded-lg border border-status-bad bg-status-bad-bg p-4">
              <p className="text-sm text-status-bad">Não foi possível montar os gráficos.</p>
              <button
                type="button"
                className="mt-2 text-sm font-medium text-brand underline-offset-2 hover:underline"
                onClick={() => setRetry((n) => n + 1)}
              >
                Tentar de novo
              </button>
            </div>
          ) : null}
          {chartsState === "ok" && breakdown ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <StatusDonut totals={breakdown.totals.total ? breakdown.totals : totals} />
                <NcmRankBars rows={breakdown.topNcm} lote={batchId} />
              </div>
              <div className={breakdown.segmento ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}>
                {breakdown.segmento ? (
                  <SegmentoRankBars groups={breakdown.segmento.groups} lote={batchId} />
                ) : null}
                <LoteSparkline batches={batches} activeId={batchId} onSelect={(id) => void onSparklineSelect(id)} />
              </div>
            </>
          ) : batches.length > 0 ? (
            <LoteSparkline batches={batches} activeId={batchId} onSelect={(id) => void onSparklineSelect(id)} />
          ) : null}
          <BatchDiffPanel lote={batchId} />
        </>
      ) : null}
    </div>
  );
}

const KPI_TONES = {
  neutral: { card: "border-line bg-white shadow-panel hover:border-brand", value: "text-ink" },
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
  percent,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number;
  percent?: number;
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
      {percent != null ? (
        <span className="mt-1 block text-xs tabular text-ink-muted">{percent}%</span>
      ) : null}
    </Link>
  );
}

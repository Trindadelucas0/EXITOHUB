"use client";

import Link from "next/link";
import type { DashboardNcmRow } from "@/src/lib/dashboard-metrics";

export function NcmRankBars({ rows, lote }: { rows: DashboardNcmRow[]; lote: string }) {
  const max = Math.max(1, ...rows.map((row) => row.divergentes + row.analise));

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-lg text-ink">NCMs que mais pedem conferência</h2>
        <Link
          href={`/consulta?lote=${encodeURIComponent(lote)}`}
          className="text-sm text-brand underline-offset-2 hover:underline"
        >
          Ver todos em Consultar
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">Nenhum NCM divergente ou em análise neste lote.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {rows.map((row) => {
            const attention = row.divergentes + row.analise;
            const width = Math.max(4, Math.round((100 * attention) / max));
            return (
              <li key={row.ncm}>
                <Link
                  href={`/consulta?ncm=${encodeURIComponent(row.ncm)}&lote=${encodeURIComponent(lote)}`}
                  className="grid gap-1 rounded-md px-1 py-1 hover:bg-paper-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium tabular text-ink">{row.ncm}</span>
                    <span className="tabular text-ink-muted">{attention} div+anál.</span>
                  </span>
                  <span className="block h-2 overflow-hidden rounded bg-paper-sunken">
                    <span
                      className="block h-2 rounded bg-status-bad"
                      style={{ width: `${width}%` }}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

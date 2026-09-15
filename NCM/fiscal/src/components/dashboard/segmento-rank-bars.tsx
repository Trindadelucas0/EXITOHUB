"use client";

import Link from "next/link";
import type { DashboardSegmentoRow } from "@/src/lib/dashboard-metrics";

export function SegmentoRankBars({
  groups,
  lote,
}: {
  groups: DashboardSegmentoRow[];
  lote: string;
}) {
  const pending = groups.filter((row) => row.divergentes + row.analise > 0);
  const max = Math.max(1, ...pending.map((row) => row.divergentes + row.analise));

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <h2 className="font-display text-lg text-ink">Segmentos</h2>
      {pending.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">Nenhum segmento com pendência neste lote.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {pending.map((row) => {
            const attention = row.divergentes + row.analise;
            const width = Math.max(4, Math.round((100 * attention) / max));
            return (
              <li key={row.id}>
                <Link
                  href={`/consulta?segmento=${encodeURIComponent(row.id)}&lote=${encodeURIComponent(lote)}`}
                  className="grid gap-1 rounded-md px-1 py-1 hover:bg-paper-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium text-ink">{row.label}</span>
                    <span className="shrink-0 tabular text-ink-muted">{attention}</span>
                  </span>
                  <span className="block h-2 overflow-hidden rounded bg-paper-sunken">
                    <span className="block h-2 rounded bg-brand" style={{ width: `${width}%` }} />
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

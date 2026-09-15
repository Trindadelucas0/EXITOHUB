"use client";

import { statusPercents, type DashboardTotals } from "@/src/lib/dashboard-metrics";

const R = 36;
const C = 2 * Math.PI * R;

const SLICES = [
  { key: "corretos" as const, label: "Corretos", color: "#1F7A45" },
  { key: "divergentes" as const, label: "Divergentes", color: "#9B2C2C" },
  { key: "analise" as const, label: "Análise", color: "#6B7280" },
];

export function StatusDonut({ totals }: { totals: DashboardTotals }) {
  const pct = statusPercents(totals);
  const values = [totals.corretos, totals.divergentes, totals.analise];
  const label = `Situação do lote: ${totals.corretos} corretos, ${totals.divergentes} divergentes, ${totals.analise} em análise`;
  let offset = 0;

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <h2 className="font-display text-lg text-ink">Situação do lote</h2>
      {totals.total <= 0 ? (
        <p className="mt-3 text-sm text-ink-muted">Lote sem linhas analisadas.</p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <svg
            role="img"
            aria-label={label}
            viewBox="0 0 100 100"
            className="h-36 w-36 shrink-0"
          >
            <circle cx="50" cy="50" r={R} fill="none" stroke="#E5E7EB" strokeWidth="14" />
            {SLICES.map((slice, index) => {
              const part = values[index] ?? 0;
              if (part <= 0) return null;
              const dash = (part / totals.total) * C;
              const gap = C - dash;
              const el = (
                <circle
                  key={slice.key}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                />
              );
              offset += dash;
              return el;
            })}
          </svg>
          <ul className="grid w-full gap-2 text-sm">
            {SLICES.map((slice) => (
              <li key={slice.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-ink">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: slice.color }} />
                  {slice.label}
                </span>
                <span className="tabular text-ink-muted">
                  {totals[slice.key]} · {pct[slice.key]}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

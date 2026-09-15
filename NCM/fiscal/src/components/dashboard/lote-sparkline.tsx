"use client";

import type { BatchOption } from "@/src/components/product/batch-selector";

const SPARKLINE_COUNT = 6;

export function LoteSparkline({
  batches,
  activeId,
  onSelect,
}: {
  batches: BatchOption[];
  activeId: string | null;
  onSelect: (batchId: string) => void;
}) {
  const recent = [...batches].slice(0, SPARKLINE_COUNT).reverse();
  const maxRows = Math.max(1, ...recent.map((batch) => batch.totalRows));

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <h2 className="font-display text-lg text-ink">Evolução dos lotes</h2>
      <p className="text-sm text-ink-muted">Últimas {recent.length} importações. Clique para abrir o lote.</p>
      {recent.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">Sem histórico de planilhas.</p>
      ) : (
        <div className="mt-4 flex h-28 items-stretch gap-2">
          {recent.map((batch) => {
            const height = Math.max(8, Math.round((100 * batch.totalRows) / maxRows));
            const selected = batch.id === activeId;
            const label = `${batch.fileName} · ${batch.totalRows} produtos`;
            return (
              <button
                key={batch.id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={selected}
                onClick={() => onSelect(batch.id)}
                className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-end rounded-md px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  selected ? "bg-brand-soft" : "hover:bg-paper-sunken"
                }`}
              >
                <span
                  className={`w-full max-w-[2.5rem] rounded-t ${selected ? "bg-brand" : "bg-ink-muted"}`}
                  style={{ height: `${height}%` }}
                />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DiffPayload = {
  previous: { id: string; fileName: string; createdAt: string } | null;
  summary: {
    added: number;
    removed: number;
    ncmChanged: number;
    statusChanged: number;
    unchanged: number;
  };
  items: {
    kind: string;
    codigo: string;
    currentNcm: string | null;
    previousNcm: string | null;
    currentStatus: string | null;
    previousStatus: string | null;
  }[];
};

const KIND_LABEL: Record<string, string> = {
  added: "Novos",
  removed: "Saíram",
  ncm_changed: "NCM mudou",
  status_changed: "Situação mudou",
};

export function BatchDiffPanel({ lote, summaryOnly = false }: { lote: string | null; summaryOnly?: boolean }) {
  const [data, setData] = useState<DiffPayload | null>(null);

  useEffect(() => {
    if (!lote) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/import/diff?lote=${encodeURIComponent(lote)}&pageSize=8`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Falha");
        setData(json.data);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [lote]);

  if (!lote || !data?.previous) return null;
  const { summary, previous, items } = data;
  const changed = summary.added + summary.removed + summary.ncmChanged + summary.statusChanged;

  return (
    <section className="grid gap-3 rounded-lg border border-line bg-white p-4">
      <div>
        <h2 className="font-display text-lg text-ink">O que mudou vs lote anterior</h2>
        <p className="text-sm text-ink-muted">
          Comparado com {previous.fileName} ({new Date(previous.createdAt).toLocaleString("pt-BR")})
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Metric label="Novos" value={summary.added} />
        <Metric label="Saíram" value={summary.removed} />
        <Metric label="NCM mudou" value={summary.ncmChanged} />
        <Metric label="Situação mudou" value={summary.statusChanged} />
      </dl>
      {summaryOnly ? null : changed === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum código novo, saído ou com NCM/situação diferente.</p>
      ) : (
        <ul className="grid gap-1 text-sm">
          {items.slice(0, 8).map((item) => (
            <li key={`${item.kind}-${item.codigo}`}>
              <Link
                className="text-brand underline-offset-2 hover:underline"
                href={`/consulta?lote=${encodeURIComponent(lote)}&q=${encodeURIComponent(item.codigo)}`}
              >
                {item.codigo}
              </Link>{" "}
              <span className="text-ink-muted">
                {KIND_LABEL[item.kind] ?? item.kind}
                {item.kind === "ncm_changed"
                  ? ` (${item.previousNcm} → ${item.currentNcm})`
                  : item.kind === "status_changed"
                    ? ` (${item.previousStatus} → ${item.currentStatus})`
                    : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const highlighted = value > 0;
  return (
    <div
      className={`rounded-md px-3 py-2 ${
        highlighted
          ? "border-l-4 border-brand bg-brand-soft shadow-brand-sm"
          : "bg-paper-sunken"
      }`}
    >
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={`font-display text-xl tabular ${highlighted ? "text-status-ok" : "text-ink-muted"}`}>
        {value}
      </dd>
    </div>
  );
}

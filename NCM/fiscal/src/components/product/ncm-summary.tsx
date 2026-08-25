"use client";

import { useEffect, useMemo, useState } from "react";
import { ncmApiUrl } from "@/src/lib/base-path";
import { Button } from "@/src/components/ui/button";

type Group = {
  ncm: string;
  total: number;
  corretos: number;
  divergentes: number;
  analise: number;
};

const TOP_VISIBLE = 8;

export function NcmSummary({
  lote,
  status,
  tratado,
  activeNcm,
  onSelect,
  onQueueChange,
  refreshKey = 0,
}: {
  lote: string | null;
  status: string;
  tratado: string;
  activeNcm: string;
  onSelect: (ncm: string) => void;
  onQueueChange?: () => void;
  refreshKey?: number;
}) {
  const [ncmCount, setNcmCount] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!lote) {
      setGroups([]);
      setNcmCount(0);
      setProductCount(0);
      return;
    }
    const params = new URLSearchParams({ lote });
    if (status) params.set("status", status);
    if (tratado) params.set("tratado", tratado);
    const controller = new AbortController();
    fetch(ncmApiUrl(`/api/products/ncm-summary?${params}`), { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Falha");
        setNcmCount(json.data.ncmCount ?? 0);
        setProductCount(json.data.productCount ?? 0);
        setGroups(json.data.groups ?? []);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [lote, status, tratado, refreshKey]);

  const filtered = useMemo(() => {
    const q = query.replace(/\D/g, "");
    if (!q) return groups;
    return groups.filter((g) => g.ncm.includes(q));
  }, [groups, query]);

  const visible = expanded ? filtered : filtered.slice(0, TOP_VISIBLE);
  const hasMore = filtered.length > TOP_VISIBLE;

  if (!lote || ncmCount === 0) return null;

  async function treatNcm(ncm: string) {
    if (!lote) return;
    await fetch(ncmApiUrl("/api/products/treated-ncm"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lote, ncm, treated: true }),
    });
    onQueueChange?.();
  }

  return (
    <section className="grid gap-3 rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink">
          <span className="font-medium tabular">{ncmCount}</span> NCMs ·{" "}
          <span className="font-medium tabular">{productCount}</span> produtos nesta fila
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="ncm-summary-busca">
            Buscar NCM na fila
          </label>
          <input
            id="ncm-summary-busca"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setExpanded(true);
            }}
            placeholder="Buscar NCM"
            inputMode="numeric"
            autoComplete="off"
            className="min-h-11 w-full min-w-0 rounded-[10px] border-0 bg-paper-sunken px-3 text-sm sm:w-44"
          />
          {hasMore ? (
            <Button type="button" variant="secondary" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Mostrar menos" : `Ver todos (${filtered.length})`}
            </Button>
          ) : null}
        </div>
      </div>
      <ul className="flex flex-wrap gap-2">
        {visible.map((group) => {
          const active = activeNcm.replace(/\D/g, "") === group.ncm;
          return (
            <li key={group.ncm}>
              <button
                type="button"
                className={`min-h-11 rounded-md border px-3 text-sm tabular ${
                  active ? "border-brand bg-brand text-white" : "border-line bg-paper-sunken hover:bg-brand-soft"
                }`}
                onClick={() => onSelect(active ? "" : group.ncm)}
              >
                {group.ncm || "(vazio)"} ({group.total})
              </button>
            </li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="text-sm text-ink-muted">Nenhum NCM com esse filtro.</li>
        ) : null}
      </ul>
      {activeNcm ? (
        <div className="grid gap-2 border-t border-line pt-3">
          <button
            type="button"
            className="min-h-11 w-fit rounded-md border border-line px-3 text-sm hover:bg-paper-sunken"
            onClick={() => void treatNcm(activeNcm)}
          >
            Marcar este NCM como já tratado
          </button>
          <p className="text-sm text-ink-muted">
            Aplica os valores corretos da regra (CST, MVA e destinos) e passa os itens a correto.
          </p>
        </div>
      ) : null}
    </section>
  );
}

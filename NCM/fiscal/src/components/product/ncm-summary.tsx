"use client";

import { useEffect, useState } from "react";

type Group = {
  ncm: string;
  total: number;
  corretos: number;
  divergentes: number;
  analise: number;
};

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
    fetch(`/api/products/ncm-summary?${params}`, { signal: controller.signal })
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

  if (!lote || ncmCount === 0) return null;

  async function treatNcm(ncm: string) {
    if (!lote) return;
    await fetch("/api/products/treated-ncm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lote, ncm, treated: true }),
    });
    onQueueChange?.();
  }

  return (
    <section className="grid gap-2 rounded-lg border border-line bg-white p-4">
      <p className="text-sm text-ink">
        <span className="font-medium tabular">{ncmCount}</span> NCMs ·{" "}
        <span className="font-medium tabular">{productCount}</span> produtos nesta fila
      </p>
      <ul className="flex flex-wrap gap-2">
        {groups.slice(0, 24).map((group) => {
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
      </ul>
      {activeNcm ? (
        <div className="grid gap-2">
          <button
            type="button"
            className="min-h-11 w-fit rounded-md border border-line px-3 text-sm"
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

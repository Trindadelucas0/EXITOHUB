"use client";

import { useEffect, useMemo, useState } from "react";
import { ncmApiUrl } from "@/src/lib/base-path";
import { SEGMENTO_FORA } from "@/src/lib/segmento";
import { Button } from "@/src/components/ui/button";

type Group = {
  id: string;
  label: string;
  total: number;
  corretos: number;
  divergentes: number;
  analise: number;
  regras: number;
};

const TOP_VISIBLE = 8;

export type SegmentoOption = Group;

export function SegmentoSummary({
  lote,
  status,
  tratado,
  activeSegmento,
  onSelect,
  onGroups,
}: {
  lote: string | null;
  status: string;
  tratado: string;
  activeSegmento: string;
  onSelect: (segmento: string) => void;
  onGroups?: (groups: SegmentoOption[]) => void;
}) {
  const [unica, setUnica] = useState(false);
  const [layoutKind, setLayoutKind] = useState<"unica" | "egaplast">("unica");
  const [productCount, setProductCount] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!lote) {
      setGroups([]);
      setUnica(false);
      setProductCount(0);
      onGroups?.([]);
      return;
    }
    const params = new URLSearchParams({ lote });
    if (status) params.set("status", status);
    if (tratado) params.set("tratado", tratado);
    const controller = new AbortController();
    fetch(ncmApiUrl(`/api/products/segmento-summary?${params}`), { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Falha");
        setUnica(Boolean(json.data.unica));
        setProductCount(json.data.productCount ?? 0);
        const next = json.data.groups ?? [];
        setGroups(next);
        onGroups?.(json.data.unica ? next : []);
        setLayoutKind(json.data.layout === "egaplast" ? "egaplast" : "unica");
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [lote, status, tratado, onGroups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.label.toLowerCase().includes(q) || g.id.includes(q));
  }, [groups, query]);

  const visible = expanded ? filtered : filtered.slice(0, TOP_VISIBLE);
  const hasMore = filtered.length > TOP_VISIBLE;
  const active = groups.find((g) => g.id === activeSegmento) ?? null;

  if (!lote || !unica || groups.length === 0) return null;

  return (
    <section className="grid gap-3 rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Segmento da base fiscal</p>
          <p className="text-sm text-ink-muted">
            {groups.length} segmento{groups.length === 1 ? "" : "s"} ·{" "}
            <span className="tabular">{productCount}</span> produtos conferidos com a regra do NCM
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="segmento-summary-busca">
            Buscar segmento
          </label>
          <input
            id="segmento-summary-busca"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setExpanded(true);
            }}
            placeholder="Buscar segmento"
            autoComplete="off"
            className="min-h-11 w-full min-w-0 rounded-[10px] border-0 bg-paper-sunken px-3 text-sm sm:w-52"
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
          const selected = activeSegmento === group.id;
          return (
            <li key={group.id}>
              <button
                type="button"
                aria-pressed={selected}
                title={group.label}
                className={`min-h-11 max-w-[18rem] truncate rounded-md border px-3 text-left text-sm ${
                  selected
                    ? "border-brand bg-brand text-white"
                    : group.divergentes > 0
                      ? "border-line bg-paper-sunken hover:bg-brand-soft"
                      : "border-line bg-white hover:bg-brand-soft"
                }`}
                onClick={() => onSelect(selected ? "" : group.id)}
              >
                <span className="block truncate">{group.label}</span>
                <span className={`block text-xs tabular ${selected ? "text-white/90" : "text-ink-muted"}`}>
                  {group.total} · {group.divergentes} div.
                  {group.regras ? ` · ${group.regras} NCM` : ""}
                </span>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="text-sm text-ink-muted">Nenhum segmento com esse filtro.</li>
        ) : null}
      </ul>
      {active ? (
        <p className="border-t border-line pt-3 text-sm text-ink-muted">
          {active.id === SEGMENTO_FORA
            ? layoutKind === "egaplast"
              ? "NCM fora da base Egaplast — a conferência marca divergente até o NCM entrar na Base fiscal."
              : "NCM fora das 125 regras da Unica — a conferência marca divergente até o NCM entrar na Base fiscal."
            : layoutKind === "egaplast"
              ? `Conferência deste segmento: CST e IVA do cadastro × regra do NCM (${active.corretos} corretos, ${active.divergentes} divergentes).`
              : `Conferência deste segmento: Abreviação do cadastro × Abrev. da base (${active.corretos} corretos, ${active.divergentes} divergentes).`}
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          Use <span className="font-medium text-ink">Filtrar segmento</span> na barra acima, ou
          clique num chip. A conferência continua sendo por NCM da base.
        </p>
      )}
    </section>
  );
}

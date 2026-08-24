"use client";

import { useEffect, useRef, useState } from "react";
import { resolveDisplayedBatchId } from "@/src/lib/batch-scope";

export type BatchOption = {
  id: string;
  fileName: string;
  totalRows: number;
  corretos: number;
  divergentes: number;
  analise: number;
  createdAt: string;
};

type ImportListCache = {
  batches: BatchOption[];
  activeBatchId: string | null;
  at: number;
};

let importListCache: ImportListCache | null = null;
const IMPORT_CACHE_FRESH_MS = 2_000;

function peekImportCache() {
  return importListCache;
}

function isFreshImportCache() {
  return Boolean(importListCache && Date.now() - importListCache.at < IMPORT_CACHE_FRESH_MS);
}

function rememberImportCache(batches: BatchOption[], activeBatchId: string | null) {
  importListCache = { batches, activeBatchId, at: Date.now() };
}

export function clearImportListCache() {
  importListCache = null;
}

async function persistSelection(batchId: string) {
  const selectRes = await fetch("/api/import/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batchId }),
  });
  if (!selectRes.ok) {
    const selectJson = await selectRes.json().catch(() => ({}));
    throw new Error(selectJson.error?.message ?? "Não foi possível selecionar a planilha.");
  }
  if (importListCache) {
    rememberImportCache(importListCache.batches, batchId);
  }
}

export function BatchSelector({
  onChange,
  preferredId,
  compact = false,
}: {
  onChange: (batchId: string | null, batches: BatchOption[]) => void;
  preferredId?: string | null;
  compact?: boolean;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [batches, setBatches] = useState<BatchOption[]>(() => peekImportCache()?.batches ?? []);
  const [activeId, setActiveId] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => !peekImportCache());
  const preferred = preferredId?.trim() || "";
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  useEffect(() => {
    if (preferred && preferred === activeIdRef.current && isFreshImportCache()) return;
    let cancelled = false;
    const cached = peekImportCache();
    if (cached) {
      const wanted = resolveDisplayedBatchId(cached.batches, preferred || null, cached.activeBatchId);
      setBatches(cached.batches);
      setActiveId(wanted);
      setLoading(false);
      onChangeRef.current(wanted || null, cached.batches);
      if (wanted && wanted !== cached.activeBatchId) {
        void persistSelection(wanted).catch((err: Error) => {
          if (!cancelled) setError(err.message);
        });
      }
      if (isFreshImportCache()) {
        return () => {
          cancelled = true;
        };
      }
    } else {
      setLoading(true);
    }

    const controller = new AbortController();
    const boot = async () => {
      const res = await fetch("/api/import", { signal: controller.signal });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Falha ao listar lotes");
      const list = (json.data.batches ?? []) as BatchOption[];
      const cookieId = (json.data.activeBatchId as string | null) ?? null;
      rememberImportCache(list, cookieId);
      if (cancelled) return;
      const wanted = resolveDisplayedBatchId(list, preferred || null, cookieId);
      setBatches(list);
      setActiveId(wanted);
      onChangeRef.current(wanted || null, list);
      if (wanted && wanted !== cookieId) {
        void persistSelection(wanted).catch((err: Error) => {
          if (!cancelled) setError(err.message);
        });
      }
    };
    boot()
      .catch((err: Error) => {
        if (cancelled || err.name === "AbortError") return;
        setError(err.message);
        if (!peekImportCache()) onChangeRef.current(null, []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [preferred]);

  async function select(batchId: string) {
    if (batchId === activeId) return;
    const previous = activeId;
    setActiveId(batchId);
    setError("");
    try {
      await persistSelection(batchId);
      onChangeRef.current(batchId, batches);
    } catch (err) {
      setActiveId(previous);
      setError(err instanceof Error ? err.message : "Não foi possível selecionar a planilha.");
    }
  }

  if (loading && batches.length === 0) {
    return <p className="text-sm text-ink-muted">Carregando planilhas importadas…</p>;
  }
  if (batches.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Nenhuma planilha importada nesta empresa. Importe um cadastro para conferir.
      </p>
    );
  }

  return (
    <div className={compact ? "min-w-0 md:max-w-xs md:flex-1" : "grid gap-2"}>
      <label className={compact ? "block min-w-0" : "grid gap-1.5 text-sm font-medium text-ink"} htmlFor="planilha-ativa">
        <span className={compact ? "sr-only" : undefined}>Planilha</span>
        <select
          id="planilha-ativa"
          className="min-h-11 w-full rounded-md border border-line bg-white px-3 text-base font-normal md:text-sm"
          value={activeId}
          onChange={(e) => void select(e.target.value)}
        >
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.fileName} · {new Date(batch.createdAt).toLocaleString("pt-BR")} ·{" "}
              {batch.totalRows} produtos
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-status-bad">{error}</p> : null}
    </div>
  );
}

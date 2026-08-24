"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductFilterSummary, ProductFilterValues } from "./product-filters";
import type { ProductSheetItem } from "./product-sheet-types";

export function buildProductsUrl(
  filters: ProductFilterValues,
  lote?: string | null,
  page = 1,
  pageSize = 25,
) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.ncm.trim()) params.set("ncm", filters.ncm.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.tratado) params.set("tratado", filters.tratado);
  if (lote) params.set("lote", lote);
  if (page > 1) params.set("page", String(page));
  if (pageSize !== 25) params.set("pageSize", String(pageSize));
  const qs = params.toString();
  return qs ? `/api/products?${qs}` : "/api/products";
}

export function useProductQuery(
  filters: ProductFilterValues,
  lote: string | null,
  enabled: boolean,
  page: number,
  pageSize: number,
  reloadKey = 0,
) {
  const [rows, setRows] = useState<ProductSheetItem[]>([]);
  const [summary, setSummary] = useState<ProductFilterSummary | undefined>();
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const q = filters.q;
  const ncm = filters.ncm;
  const status = filters.status;
  const tratado = filters.tratado;
  const prevText = useRef({ q, ncm });

  useEffect(() => {
    if (!enabled) return;
    if (!lote) {
      setRows([]);
      setSummary({ total: 0, corretos: 0, divergentes: 0, analise: 0 });
      setCatalogTotal(0);
      setTotal(0);
      setPageCount(1);
      setLoading(false);
      setError("");
      return;
    }
    const textChanged = prevText.current.q !== q || prevText.current.ncm !== ncm;
    prevText.current = { q, ncm };
    const delay = textChanged && (q || ncm) ? 250 : 0;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      fetch(buildProductsUrl({ q, ncm, status, tratado }, lote, page, pageSize), {
        signal: controller.signal,
      })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error?.message ?? "Falha");
          setRows(json.data.items);
          setSummary(json.data.summary);
          setCatalogTotal(json.data.catalogTotal ?? 0);
          setTotal(json.data.total ?? json.data.items.length);
          setPageCount(json.data.pageCount ?? 1);
        })
        .catch((err: Error) => {
          if (err.name === "AbortError") return;
          setError(err.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, ncm, status, tratado, lote, enabled, page, pageSize, reloadKey]);

  return { rows, summary, catalogTotal, total, pageCount, loading: !enabled || loading, error };
}

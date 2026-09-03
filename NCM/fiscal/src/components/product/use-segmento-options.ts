"use client";

import { useEffect, useState } from "react";
import { ncmApiUrl } from "@/src/lib/base-path";

export type SegmentoOption = {
  id: string;
  label: string;
  total: number;
  corretos: number;
  divergentes: number;
  analise: number;
  regras: number;
};

export function useSegmentoOptions(lote: string | null, status: string, tratado: string) {
  const [options, setOptions] = useState<SegmentoOption[]>([]);

  useEffect(() => {
    if (!lote) {
      setOptions([]);
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
        setOptions(json.data.unica ? (json.data.groups ?? []) : []);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [lote, status, tratado]);

  return options;
}

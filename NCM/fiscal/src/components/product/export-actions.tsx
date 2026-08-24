"use client";

import { useState } from "react";
import type { ProductFilterValues } from "@/src/components/product/product-filters";
import { ExportFileButton } from "@/src/components/ui/export-file-button";

type ExportScope = ProductFilterValues["status"];

const SCOPES: { id: ExportScope; label: string }[] = [
  { id: "", label: "Todos" },
  { id: "DIVERGENTE", label: "Divergentes" },
  { id: "NECESSITA_ANALISE", label: "Análise" },
  { id: "CORRETO", label: "Corretos" },
];

function exportHref(format: "excel" | "pdf", batchId: string | null, tratado: string, status: ExportScope) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (batchId) params.set("lote", batchId);
  if (tratado) params.set("tratado", tratado);
  const query = params.toString();
  return `/api/export/${format}${query ? `?${query}` : ""}`;
}

export function ExportActions({
  batchId,
  tratado,
}: {
  batchId: string | null;
  tratado: ProductFilterValues["tratado"];
}) {
  const [scope, setScope] = useState<ExportScope>("DIVERGENTE");

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
      <div className="min-w-0 sm:w-44">
        <label htmlFor="exportar-situacao" className="mb-1 block text-xs font-medium text-ink-muted">
          Incluir no arquivo
        </label>
        <select
          id="exportar-situacao"
          className="min-h-11 w-full rounded-md border border-line bg-white px-3 text-base text-ink md:text-sm"
          value={scope}
          onChange={(event) => setScope(event.target.value as ExportScope)}
        >
          {SCOPES.map((item) => (
            <option key={item.id || "todos"} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <ExportFileButton href={exportHref("excel", batchId, tratado, scope)}>Exportar Excel</ExportFileButton>
      <ExportFileButton href={exportHref("pdf", batchId, tratado, scope)}>Exportar PDF</ExportFileButton>
    </div>
  );
}

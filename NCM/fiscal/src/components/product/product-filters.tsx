"use client";

import type { ReactNode } from "react";
import { SheetToolbar } from "@/src/components/ui/sheet-toolbar";
import { Field } from "@/src/components/ui/field";
import { Button } from "@/src/components/ui/button";

export type ProductFilterValues = {
  q: string;
  ncm: string;
  status: "" | "DIVERGENTE" | "NECESSITA_ANALISE" | "CORRETO";
  tratado: "" | "nao" | "sim";
};

export function parseStatusFilter(
  raw: string | null,
  fallback: ProductFilterValues["status"] = "",
): ProductFilterValues["status"] {
  if (raw === "DIVERGENTE" || raw === "NECESSITA_ANALISE" || raw === "CORRETO") return raw;
  return fallback;
}

export type ProductFilterSummary = {
  total: number;
  corretos: number;
  divergentes: number;
  analise: number;
};

const STATUS_CHIPS: {
  id: ProductFilterValues["status"];
  label: string;
  count: keyof ProductFilterSummary;
}[] = [
  { id: "", label: "Todos", count: "total" },
  { id: "DIVERGENTE", label: "Divergente", count: "divergentes" },
  { id: "NECESSITA_ANALISE", label: "Análise", count: "analise" },
  { id: "CORRETO", label: "Correto", count: "corretos" },
];

export function ProductFilters({
  values,
  summary,
  onChange,
  resetStatus = "",
  hideTreatedDefault = false,
  lead,
}: {
  values: ProductFilterValues;
  summary?: ProductFilterSummary;
  onChange: (next: ProductFilterValues) => void;
  resetStatus?: ProductFilterValues["status"];
  hideTreatedDefault?: boolean;
  lead?: ReactNode;
}) {
  const dirty = Boolean(
    values.q ||
      values.ncm ||
      values.status !== resetStatus ||
      (hideTreatedDefault ? values.tratado !== "nao" : Boolean(values.tratado)),
  );

  return (
    <SheetToolbar>
      {lead}
      <div className="min-w-0 flex-1 md:max-w-xs">
        <Field
          compact
          id="filtro-busca"
          label="Código ou descrição"
          value={values.q}
          onChange={(e) => onChange({ ...values, q: e.target.value })}
          placeholder="Código ou descrição"
          autoComplete="off"
        />
      </div>
      <div className="w-full min-w-0 md:w-36">
        <Field
          compact
          id="filtro-ncm"
          label="NCM"
          value={values.ncm}
          onChange={(e) => onChange({ ...values, ncm: e.target.value })}
          placeholder="NCM"
          inputMode="numeric"
          autoComplete="off"
        />
      </div>
      <div className="flex min-w-0 flex-wrap gap-1.5" role="group" aria-label="Filtrar por situação">
        {STATUS_CHIPS.map((chip) => {
          const active = values.status === chip.id;
          const count = summary?.[chip.count];
          return (
            <button
              key={chip.id || "todos"}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...values, status: chip.id })}
              className={`min-h-11 rounded-md border px-2.5 text-sm font-medium transition ${
                active
                  ? "border-brand bg-brand text-white"
                  : "border-line-strong bg-white text-ink hover:bg-brand-soft"
              }`}
            >
              {chip.label}
              {typeof count === "number" ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>
      {hideTreatedDefault ? (
        <button
          type="button"
          aria-pressed={values.tratado === "nao"}
          onClick={() =>
            onChange({ ...values, tratado: values.tratado === "nao" ? "" : "nao" })
          }
          className={`min-h-11 rounded-md border px-2.5 text-sm font-medium ${
            values.tratado === "nao"
              ? "border-brand bg-brand text-white"
              : "border-line-strong bg-white text-ink hover:bg-brand-soft"
          }`}
        >
          Ocultar tratados
        </button>
      ) : null}
      {dirty ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            onChange({
              q: "",
              ncm: "",
              status: resetStatus,
              tratado: hideTreatedDefault ? "nao" : "",
            })
          }
        >
          Limpar
        </Button>
      ) : null}
    </SheetToolbar>
  );
}

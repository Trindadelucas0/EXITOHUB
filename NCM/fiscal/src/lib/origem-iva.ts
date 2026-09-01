import { hasFilledIvaPorUf, type IvaPorUf } from "@/src/lib/iva-por-uf";

export type OrigemIvaKind = "nacional" | "importado";

export function classifyOrigemIva(raw: string | null | undefined): OrigemIvaKind {
  const text = String(raw ?? "").trim().toUpperCase();
  const digit = text.match(/^(\d)/)?.[1];
  if (digit === "1" || digit === "2" || digit === "3" || digit === "6" || digit === "7" || digit === "8") {
    return "importado";
  }
  if (text.includes("ESTRANGEIRA") || (text.includes("IMPORT") && !text.includes("NACIONAL"))) {
    return "importado";
  }
  return "nacional";
}

export function origemIvaLabel(raw: string | null | undefined): {
  kind: OrigemIvaKind;
  short: string;
  detail: string;
} {
  const kind = classifyOrigemIva(raw);
  const detail = String(raw ?? "").trim();
  if (kind === "importado") {
    return { kind, short: "Importado", detail: detail || "Importado" };
  }
  if (/^9/.test(detail) || detail.toUpperCase().includes("PRODU")) {
    return { kind, short: "Produção (nacional)", detail: detail || "Nacional" };
  }
  return { kind, short: "Nacional", detail: detail || "Nacional" };
}

export function ivaIdealForOrigem(
  rule: { ivaPorUf?: IvaPorUf | null; ivaPorUfImportado?: IvaPorUf | null } | null | undefined,
  origem?: string | null,
): IvaPorUf | null {
  if (!rule) return null;
  const kind = classifyOrigemIva(origem);
  const nacional = hasFilledIvaPorUf(rule.ivaPorUf) ? (rule.ivaPorUf ?? null) : null;
  const importado = hasFilledIvaPorUf(rule.ivaPorUfImportado) ? (rule.ivaPorUfImportado ?? null) : null;
  if (kind === "importado") return importado ?? nacional;
  return nacional ?? importado;
}

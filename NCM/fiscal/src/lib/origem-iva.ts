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

export type IvaMapRule = {
  cstSaida?: string | null;
  ivaPorUf?: IvaPorUf | null;
  ivaPorUfImportado?: IvaPorUf | null;
};

export function ruleHasIvaMap(rule: IvaMapRule | null | undefined): boolean {
  if (!rule) return false;
  return hasFilledIvaPorUf(rule.ivaPorUf) || hasFilledIvaPorUf(rule.ivaPorUfImportado);
}

function foldCst(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  return String(Number.parseInt(digits, 10));
}

/** IVA da regra escolhida; se ela não tiver mapa, usa irmã CST+IVA do mesmo NCM. */
export function ivaIdealFromRules(
  rule: IvaMapRule | null | undefined,
  candidates: IvaMapRule[] | null | undefined,
  origem?: string | null,
  cstUnico?: string | null,
): IvaPorUf | null {
  const fromRule = ivaIdealForOrigem(rule, origem);
  if (hasFilledIvaPorUf(fromRule)) return fromRule;
  const withIva = (candidates ?? []).filter(ruleHasIvaMap);
  const cst = foldCst(cstUnico);
  const byCst = cst != null ? withIva.filter((item) => foldCst(item.cstSaida) === cst) : [];
  return ivaIdealForOrigem(byCst[0] ?? withIva[0], origem);
}

/**
 * Coluna “Como deve ficar”: regra CST+IVA (ou irmã do NCM);
 * se a base só tiver TRIBUTACAO_UF sem mapa, usa o IVA do cadastro (SIGNATÁRIO).
 * Não usa o MVA % da TRIBUTACAO NCM.
 */
export function ivaIdealForDisplay(
  rule: IvaMapRule | null | undefined,
  candidates: IvaMapRule[] | null | undefined,
  origem?: string | null,
  cstUnico?: string | null,
  cadastroIva?: IvaPorUf | null,
): IvaPorUf | null {
  const fromRules = ivaIdealFromRules(rule, candidates, origem, cstUnico);
  if (hasFilledIvaPorUf(fromRules)) return fromRules;
  return hasFilledIvaPorUf(cadastroIva) ? (cadastroIva ?? null) : null;
}

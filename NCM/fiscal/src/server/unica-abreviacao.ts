import unicaSeed from "@/data/base-unica.json";

type SeedRule = {
  ncm?: string;
  abreviacao?: string | null;
};

let cached: Map<string, string> | null = null;

/** Abreviação oficial Unica (Atacadista / seed), indexada por NCM de 8 dígitos. */
export function unicaAbreviacaoByNcm(): Map<string, string> {
  if (cached) return cached;
  const rules = (unicaSeed as { rules?: SeedRule[] }).rules ?? [];
  cached = new Map();
  for (const rule of rules) {
    const ncm = String(rule.ncm ?? "").trim();
    const abreviacao = rule.abreviacao == null ? "" : String(rule.abreviacao).trim();
    if (ncm.length === 8 && abreviacao) cached.set(ncm, abreviacao);
  }
  return cached;
}

export function fillMissingUnicaAbreviacao<T extends { ncm: string; abreviacao?: string | null }>(
  rules: T[],
): T[] {
  const map = unicaAbreviacaoByNcm();
  return rules.map((rule) => {
    if (rule.abreviacao !== undefined) return rule;
    const fromOfficial = map.get(rule.ncm);
    if (!fromOfficial) return rule;
    return { ...rule, abreviacao: fromOfficial };
  });
}

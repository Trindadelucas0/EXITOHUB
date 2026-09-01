/** Ordem da print Egaplast (4 linhas IVA/ICMS). Última linha tem 6 UFs. */
export const EGAPLAST_IVA_UF_ROWS: readonly (readonly string[])[] = [
  ["AC", "AL", "AM", "AP", "BA", "CE", "DF"],
  ["ES", "GO", "MA", "MG", "MS", "MT", "PA"],
  ["PB", "PE", "PI", "PR", "RJ", "RN", "RO"],
  ["RR", "RS", "SE", "SC", "SP", "TO"],
] as const;

export const EGAPLAST_IVA_UF_KEYS = EGAPLAST_IVA_UF_ROWS.flat();

export type IvaPorUf = Partial<Record<string, string | null>>;

export function emptyIvaPorUf(): IvaPorUf {
  const out: IvaPorUf = {};
  for (const uf of EGAPLAST_IVA_UF_KEYS) out[uf] = null;
  return out;
}

export function hasFilledIvaPorUf(raw: IvaPorUf | null | undefined): boolean {
  if (!raw) return false;
  return EGAPLAST_IVA_UF_KEYS.some((uf) => {
    const value = raw[uf];
    return value != null && String(value).trim() !== "";
  });
}

export function asIvaPorUf(raw: unknown): IvaPorUf | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const out: IvaPorUf = {};
  let filled = 0;
  for (const uf of EGAPLAST_IVA_UF_KEYS) {
    const value = record[uf];
    const text = value == null ? null : String(value).trim();
    const cell = !text || text === "-" || text === "–" || text === "—" ? null : text;
    out[uf] = cell;
    if (cell) filled += 1;
  }
  return filled > 0 ? out : null;
}

export function parseIvaFactor(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text || text === "-" || text === "–") return null;
  let cleaned = text.replace("%", "").trim();
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(",", ".");
  }
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function ivaCellsDiverge(
  atual: string | null | undefined,
  ideal: string | null | undefined,
): boolean {
  const a = parseIvaFactor(atual ?? null);
  const b = parseIvaFactor(ideal ?? null);
  if (b == null) return false;
  if (a == null) return true;
  return Math.abs(a - b) > 0.05;
}

export function ivaPorUfDiffs(atual: IvaPorUf | null | undefined, ideal: IvaPorUf | null | undefined) {
  if (!ideal) return [] as { uf: string; atual: string; ideal: string }[];
  const diffs: { uf: string; atual: string; ideal: string }[] = [];
  for (const uf of EGAPLAST_IVA_UF_KEYS) {
    const a = atual?.[uf] ?? null;
    const b = ideal[uf] ?? null;
    if (ivaCellsDiverge(a, b)) {
      diffs.push({ uf, atual: a ?? "(vazio)", ideal: b ?? "—" });
    }
  }
  return diffs;
}

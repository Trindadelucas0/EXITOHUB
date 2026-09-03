export type DestinoKey =
  | "naoContribuinte"
  | "contribuinte"
  | "revenda"
  | "construtora"
  | "hospClinica"
  | "orgaoPublico"
  | "produtorRural"
  | "atacado";

export type DestinosCst = Record<DestinoKey, string | null>;

export const DESTINO_KEYS: DestinoKey[] = [
  "naoContribuinte",
  "contribuinte",
  "revenda",
  "construtora",
  "hospClinica",
  "orgaoPublico",
  "produtorRural",
  "atacado",
];

export const DESTINO_LABELS: Record<DestinoKey, string> = {
  naoContribuinte: "Não contribuinte",
  contribuinte: "Contribuinte",
  revenda: "Revenda",
  construtora: "Construtora",
  hospClinica: "Hosp/clínica",
  orgaoPublico: "Órgão público",
  produtorRural: "Produtor rural",
  atacado: "Atacado",
};

export const DESTINO_SHORT_LABELS: Record<DestinoKey, string> = {
  naoContribuinte: "Não contr",
  contribuinte: "Contrib",
  revenda: "Revenda",
  construtora: "Construt",
  hospClinica: "Hosp/clín",
  orgaoPublico: "Órgão púb",
  produtorRural: "Prod.rural",
  atacado: "Atacado",
};

export function displayCst(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  return value;
}

export function cstCellsDiverge(
  atual: string | null | undefined,
  ideal: string | null | undefined,
): boolean {
  if (ideal == null || ideal === "") return false;
  if (atual == null || atual === "") return true;
  const fold = (value: string) => value.replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0";
  return fold(atual) !== fold(ideal);
}

export type StatusFiscal = "CORRETO" | "DIVERGENTE" | "NECESSITA_ANALISE";

export type FieldDiff = {
  campo: string;
  atual: string;
  ideal: string;
};

export function labelCampoFiscal(campo: string): string {
  if (campo === "CST saída") return "CST da empresa (saída)";
  if (campo === "CST compra / nota de entrada") return "CST de compra (entrada)";
  if (campo === "Abreviação") return "Abreviação fiscal";
  if (campo.startsWith("IVA ")) return `IVA/ICMS ${campo.slice(4)}`;
  return campo;
}

export function isUnicaSituacao(situacaoCodigo: string | null | undefined): boolean {
  return situacaoCodigo === "TRIBUTACAO_UF";
}

export const UF_KEYS = ["DF", "GO", "MG"] as const;
export type UfKey = (typeof UF_KEYS)[number];

export type UfTributacaoCell = {
  original: string | null;
  ajustada4: string | null;
  ajustada7: string | null;
  ajustada12: string | null;
  aliqInterna: string | null;
};

export type UfTributacao = Record<UfKey, UfTributacaoCell>;

export function emptyUfCell(): UfTributacaoCell {
  return {
    original: null,
    ajustada4: null,
    ajustada7: null,
    ajustada12: null,
    aliqInterna: null,
  };
}

export function emptyUfTributacao(): UfTributacao {
  return { DF: emptyUfCell(), GO: emptyUfCell(), MG: emptyUfCell() };
}

function dashToNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text === "-" || text === "–" || text === "—") return null;
  return text;
}

export function asUfTributacao(raw: unknown): UfTributacao | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const out = emptyUfTributacao();
  let filled = 0;
  for (const uf of UF_KEYS) {
    const cell = record[uf];
    if (!cell || typeof cell !== "object") continue;
    const row = cell as Record<string, unknown>;
    out[uf] = {
      original: dashToNull(row.original),
      ajustada4: dashToNull(row.ajustada4),
      ajustada7: dashToNull(row.ajustada7),
      ajustada12: dashToNull(row.ajustada12),
      aliqInterna: dashToNull(row.aliqInterna),
    };
    if (Object.values(out[uf]).some(Boolean)) filled += 1;
  }
  return filled > 0 ? out : null;
}

export function hasUfTributacao(raw: unknown): boolean {
  return asUfTributacao(raw) != null;
}

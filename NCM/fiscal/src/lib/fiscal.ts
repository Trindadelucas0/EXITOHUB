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
  if (campo === "CST BAIFER") return "CST da empresa (saída)";
  if (campo === "CST compra / nota de entrada") return "CST de compra (entrada)";
  return campo;
}

import { DESTINO_KEYS, type DestinosCst } from "@/src/lib/fiscal";

export const SITUACAO_CODIGOS = [
  "REGRA_GERAL",
  "ST_INTERNO",
  "ST_NACIONAL",
  "REDUCAO",
  "INCOMPLETA",
] as const;

export type SituacaoCodigo = (typeof SITUACAO_CODIGOS)[number];

function foldUpper(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
}

export function classifySituacao(situacao: string, cstSaida: string, cfop: string): SituacaoCodigo {
  const sit = foldUpper(situacao || "");
  const cst = (cstSaida || "").trim();
  const cfopSaida = (cfop || "").trim();
  if (sit.includes("ST INTERNO")) return "ST_INTERNO";
  if (sit.includes("ST NACIONAL")) return "ST_NACIONAL";
  if (sit.includes("REDUC")) return "REDUCAO";
  if (sit.includes("REGRA GERAL")) return "REGRA_GERAL";
  if (!cst || !cfopSaida) return "INCOMPLETA";
  if ((cst === "0" || cst === "00") && cfopSaida === "5102") return "REGRA_GERAL";
  if (cst === "60" && cfopSaida === "5405") return "ST_NACIONAL";
  if (cst === "10" && cfopSaida === "5403") return "ST_INTERNO";
  return "INCOMPLETA";
}

export function parseMvaFields(raw: unknown): {
  mvaPercentual: number | null;
  mvaTexto: string | null;
  mvaKind: string;
} {
  if (raw == null || raw === "") {
    return { mvaPercentual: null, mvaTexto: null, mvaKind: "skip" };
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    let number = raw;
    if (number > 0 && number <= 1) number = Math.round(number * 100 * 10000) / 10000;
    return { mvaPercentual: number, mvaTexto: String(raw), mvaKind: "numeric" };
  }
  const text = String(raw).trim();
  if (!text) return { mvaPercentual: null, mvaTexto: null, mvaKind: "skip" };
  const folded = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (folded === "nao") {
    return { mvaPercentual: null, mvaTexto: text, mvaKind: "skip" };
  }
  if (folded.includes("#n/d") || folded.includes("#n/a") || folded.includes("#nd") || folded.startsWith("sim")) {
    return { mvaPercentual: null, mvaTexto: text, mvaKind: "analise" };
  }
  let cleaned = text.replace("%", "").trim();
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(",", ".");
  }
  const number = Number.parseFloat(cleaned);
  if (!Number.isFinite(number)) {
    return { mvaPercentual: null, mvaTexto: text, mvaKind: "analise" };
  }
  const normalized = number > 0 && number <= 1 ? Math.round(number * 10000) / 100 : number;
  return { mvaPercentual: normalized, mvaTexto: text, mvaKind: "numeric" };
}

export function emptyDestinos(): DestinosCst {
  return {
    naoContribuinte: null,
    contribuinte: null,
    revenda: null,
    construtora: null,
    hospClinica: null,
    orgaoPublico: null,
    produtorRural: null,
    atacado: null,
  };
}

export function destinosFromCells(cells: string[], start: number): DestinosCst {
  const destinos = emptyDestinos();
  DESTINO_KEYS.forEach((key, index) => {
    const raw = (cells[start + index] ?? "").trim();
    destinos[key] = raw || null;
  });
  return destinos;
}

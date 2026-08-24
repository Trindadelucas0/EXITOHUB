import * as XLSX from "xlsx";
import { DESTINO_KEYS, DESTINO_LABELS, type DestinosCst } from "@/src/lib/fiscal";
import { normalizeNcm } from "./ncm";
import {
  classifySituacao,
  destinosFromCells,
  emptyDestinos,
  parseMvaFields,
} from "./rule-classify";

export type ParsedRule = {
  ncm: string;
  ncmOriginal: string;
  segmento: string;
  cstEntrada: string | null;
  cstSaida: string | null;
  cfopSaida: string | null;
  destinosCst: DestinosCst;
  situacao: string;
  situacaoCodigo: string;
  mvaPercentual: number | null;
  mvaTexto: string | null;
  mvaKind: string;
};

const SKIP_SHEETS = new Set(["planilha_classes_fiscais", "ncm_geral"]);

function foldHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  const text = String(value).trim();
  if (text.toLowerCase() === "none" || text.toLowerCase() === "nan") return "";
  return text;
}

const HEADER_MAP: Record<string, string> = {
  ncm: "ncm",
  segmento: "segmento",
  descricao: "segmento",
  "cst entrada": "cstEntrada",
  "cst compra": "cstEntrada",
  "cst saida": "cstSaida",
  "cst saida ": "cstSaida",
  "cst baifer": "cstSaida",
  cfop: "cfopSaida",
  "cfop saida": "cfopSaida",
  situacao: "situacao",
  mva: "mva",
  iva: "mva",
};

for (const key of DESTINO_KEYS) {
  HEADER_MAP[foldHeader(DESTINO_LABELS[key])] = key;
  HEADER_MAP[foldHeader(key)] = key;
}

function mapHeader(header: string): string | null {
  const folded = foldHeader(header);
  if (HEADER_MAP[folded]) return HEADER_MAP[folded];
  for (const [key, mapped] of Object.entries(HEADER_MAP)) {
    if (key.length < 3) continue;
    if (folded.includes(key)) return mapped;
  }
  return null;
}

function looksLikeHeaderRow(cells: unknown[]): boolean {
  const folded = cells.map((c) => foldHeader(cellStr(c)));
  return folded.some((c) => c === "ncm") && folded.some((c) => c.includes("segment") || c === "cfop" || c.includes("situacao"));
}

function rowToRuleFromHeaders(row: Record<string, unknown>): ParsedRule | null {
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const dest = mapHeader(key);
    if (!dest || mapped[dest]) continue;
    mapped[dest] = cellStr(value);
  }
  const ncmOriginal = mapped.ncm || "";
  const ncm = normalizeNcm(ncmOriginal);
  if (ncm.length !== 8) return null;
  const destinos = emptyDestinos();
  for (const key of DESTINO_KEYS) {
    destinos[key] = mapped[key] || null;
  }
  const cstSaida = mapped.cstSaida || null;
  const cfopSaida = mapped.cfopSaida || null;
  const situacao = mapped.situacao || "";
  const mva = parseMvaFields(mapped.mva || null);
  return {
    ncm,
    ncmOriginal: ncmOriginal.trim(),
    segmento: mapped.segmento || "",
    cstEntrada: mapped.cstEntrada || null,
    cstSaida,
    cfopSaida,
    destinosCst: destinos,
    situacao,
    situacaoCodigo: classifySituacao(situacao, cstSaida || "", cfopSaida || ""),
    mvaPercentual: mva.mvaPercentual,
    mvaTexto: mva.mvaTexto,
    mvaKind: mva.mvaKind,
  };
}

function rowToRulePositional(raw: unknown[]): ParsedRule | null {
  const cells = raw.map(cellStr);
  while (cells.length < 15) cells.push("");
  const ncmOriginal = cells[0];
  const ncm = normalizeNcm(ncmOriginal);
  if (!ncmOriginal || ncm.length !== 8) return null;
  const destinos = destinosFromCells(cells, 5);
  const cstSaida = cells[3] || destinos.atacado || destinos.revenda || destinos.contribuinte;
  const cfopSaida = cells[4] || null;
  const situacao = cells[13] || "";
  const mva = parseMvaFields(raw[14] ?? cells[14] ?? null);
  return {
    ncm,
    ncmOriginal: ncmOriginal.trim(),
    segmento: cells[1] || "",
    cstEntrada: cells[2] || null,
    cstSaida: cstSaida || null,
    cfopSaida,
    destinosCst: destinos,
    situacao,
    situacaoCodigo: classifySituacao(situacao, cstSaida || "", cfopSaida || ""),
    mvaPercentual: mva.mvaPercentual,
    mvaTexto: mva.mvaTexto,
    mvaKind: mva.mvaKind,
  };
}

function pickSheet(workbook: XLSX.WorkBook): string {
  const names = workbook.SheetNames.filter((n) => !SKIP_SHEETS.has(n.trim().toLowerCase()));
  if (names.length === 0) {
    throw new Error("Nenhuma aba de regras válida no arquivo.");
  }
  return names[0];
}

export function parseRulesBuffer(buffer: Buffer): ParsedRule[] {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  const sheetName = pickSheet(workbook);
  const sheet = workbook.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (aoa.length === 0) return [];
  const header = looksLikeHeaderRow(aoa[0] ?? []);
  if (header) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    return rows.map(rowToRuleFromHeaders).filter((item): item is ParsedRule => item != null);
  }
  const firstNcm = normalizeNcm(cellStr((aoa[0] ?? [])[0]));
  const start = firstNcm.length === 8 ? 0 : 1;
  return aoa
    .slice(start)
    .map(rowToRulePositional)
    .filter((item): item is ParsedRule => item != null);
}

export function dedupeParsedRules(rules: ParsedRule[]): ParsedRule[] {
  const map = new Map<string, ParsedRule>();
  for (const rule of rules) {
    map.set(`${rule.ncm}::${rule.situacaoCodigo}`, rule);
  }
  return [...map.values()];
}

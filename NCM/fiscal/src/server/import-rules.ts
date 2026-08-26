import * as XLSX from "xlsx";
import {
  DESTINO_KEYS,
  DESTINO_LABELS,
  DESTINO_SHORT_LABELS,
  type DestinosCst,
} from "@/src/lib/fiscal";
import { normalizeCfop, normalizeNcm } from "./ncm";
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

export type ParseRulesOptions = {
  companyName?: string | null;
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
  "nota de entrada cst": "cstEntrada",
  "nota de entrada": "cstEntrada",
  "cst saida": "cstSaida",
  "cst baifer": "cstSaida",
  cfop: "cfopSaida",
  "cfop saida": "cfopSaida",
  "cfop de saida": "cfopSaida",
  situacao: "situacao",
  mva: "mva",
  iva: "mva",
};

for (const key of DESTINO_KEYS) {
  HEADER_MAP[foldHeader(DESTINO_LABELS[key])] = key;
  HEADER_MAP[foldHeader(DESTINO_SHORT_LABELS[key])] = key;
  HEADER_MAP[foldHeader(key)] = key;
}

function mapHeader(header: string): string | null {
  const folded = foldHeader(header);
  if (folded === "aliquota" || folded === "%aliquota") return null;
  if (HEADER_MAP[folded]) return HEADER_MAP[folded];
  for (const [key, mapped] of Object.entries(HEADER_MAP)) {
    if (key.length < 3) continue;
    if (folded.includes(key)) return mapped;
  }
  return null;
}

function looksLikeHeaderRow(cells: unknown[]): boolean {
  const folded = cells.map((c) => foldHeader(cellStr(c)));
  return (
    folded.some((c) => c === "ncm") &&
    folded.some((c) => c.includes("segment") || c.includes("cfop") || c.includes("situacao"))
  );
}

function looksLikeRulesSheet(sheet: XLSX.WorkSheet): boolean {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (aoa.length === 0) return false;
  if (looksLikeHeaderRow(aoa[0] ?? [])) return true;
  const firstNcm = normalizeNcm(cellStr((aoa[0] ?? [])[0]));
  return firstNcm.length === 8;
}

function shouldSkipSheetName(name: string): boolean {
  const trimmed = name.trim();
  const folded = trimmed.toLowerCase();
  if (SKIP_SHEETS.has(folded)) return true;
  if (folded.startsWith("file://") || folded.includes("#")) return true;
  if (folded.startsWith("planilha") && folded !== "planilha_classes_fiscais") {
    // Planilha4 e similares vazias
    if (/^planilha\d+$/i.test(trimmed)) return true;
  }
  return false;
}

function companySheetHint(companyName: string | null | undefined): "BAIFER" | "LOJA" | null {
  const folded = foldHeader(companyName || "");
  if (!folded) return null;
  if (folded.includes("loja")) return "LOJA";
  if (folded.includes("baifer")) return "BAIFER";
  return null;
}

function deriveCstSaida(mappedCst: string | null, destinos: DestinosCst): string | null {
  if (mappedCst) return mappedCst;
  return destinos.atacado || destinos.revenda || destinos.contribuinte || null;
}

function buildRule(input: {
  ncmOriginal: string;
  segmento: string;
  cstEntrada: string | null;
  cstSaida: string | null;
  cfopSaida: string | null;
  destinos: DestinosCst;
  situacao: string;
  mvaRaw: unknown;
}): ParsedRule | null {
  const ncm = normalizeNcm(input.ncmOriginal);
  if (ncm.length !== 8) return null;
  const cstSaida = deriveCstSaida(input.cstSaida, input.destinos);
  const cfopSaida = normalizeCfop(input.cfopSaida);
  const situacao = input.situacao || "";
  const mva = parseMvaFields(input.mvaRaw);
  return {
    ncm,
    ncmOriginal: input.ncmOriginal.trim(),
    segmento: input.segmento || "",
    cstEntrada: input.cstEntrada || null,
    cstSaida,
    cfopSaida,
    destinosCst: input.destinos,
    situacao,
    situacaoCodigo: classifySituacao(situacao, cstSaida || "", cfopSaida || ""),
    mvaPercentual: mva.mvaPercentual,
    mvaTexto: mva.mvaTexto,
    mvaKind: mva.mvaKind,
  };
}

function rowToRuleFromHeaders(row: Record<string, unknown>): ParsedRule | null {
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const dest = mapHeader(key);
    if (!dest || mapped[dest]) continue;
    mapped[dest] = cellStr(value);
  }
  const ncmOriginal = mapped.ncm || "";
  if (!ncmOriginal) return null;
  const destinos = emptyDestinos();
  for (const key of DESTINO_KEYS) {
    destinos[key] = mapped[key] || null;
  }
  return buildRule({
    ncmOriginal,
    segmento: mapped.segmento || "",
    cstEntrada: mapped.cstEntrada || null,
    cstSaida: mapped.cstSaida || null,
    cfopSaida: mapped.cfopSaida || null,
    destinos,
    situacao: mapped.situacao || "",
    mvaRaw: mapped.mva || null,
  });
}

/** Layout BAIFER posicional: NCM, Segmento, CST entrada, CST saída, CFOP, 8 destinos, Situação, MVA. */
function rowToRulePositionalBaifer(raw: unknown[]): ParsedRule | null {
  const cells = raw.map(cellStr);
  while (cells.length < 15) cells.push("");
  const ncmOriginal = cells[0];
  if (!ncmOriginal) return null;
  const destinos = destinosFromCells(cells, 5);
  return buildRule({
    ncmOriginal,
    segmento: cells[1] || "",
    cstEntrada: cells[2] || null,
    cstSaida: cells[3] || null,
    cfopSaida: cells[4] || null,
    destinos,
    situacao: cells[13] || "",
    mvaRaw: raw[14] ?? cells[14] ?? null,
  });
}

/** Layout LOJA posicional: NCM, Segmento, CST entrada, CFOP, 8 destinos, Situação (sem CST saída/MVA). */
function rowToRulePositionalLoja(raw: unknown[]): ParsedRule | null {
  const cells = raw.map(cellStr);
  while (cells.length < 13) cells.push("");
  const ncmOriginal = cells[0];
  if (!ncmOriginal) return null;
  const destinos = destinosFromCells(cells, 4);
  return buildRule({
    ncmOriginal,
    segmento: cells[1] || "",
    cstEntrada: cells[2] || null,
    cstSaida: null,
    cfopSaida: cells[3] || null,
    destinos,
    situacao: cells[12] || "",
    mvaRaw: null,
  });
}

export function pickRulesSheet(
  workbook: XLSX.WorkBook,
  companyName?: string | null,
): string {
  const candidates = workbook.SheetNames.filter((n) => !shouldSkipSheetName(n));
  if (candidates.length === 0) {
    throw new Error("Nenhuma aba de regras válida no arquivo.");
  }

  const hint = companySheetHint(companyName);
  if (hint) {
    const exact = candidates.find((n) => n.trim().toUpperCase() === hint);
    if (exact && looksLikeRulesSheet(workbook.Sheets[exact])) return exact;
  }

  for (const preferred of ["BAIFER", "LOJA"] as const) {
    if (hint && preferred !== hint) continue;
    const match = candidates.find((n) => n.trim().toUpperCase() === preferred);
    if (match && looksLikeRulesSheet(workbook.Sheets[match])) return match;
  }

  for (const name of candidates) {
    if (looksLikeRulesSheet(workbook.Sheets[name])) return name;
  }

  return candidates[0];
}

export function parseRulesBuffer(buffer: Buffer, options: ParseRulesOptions = {}): ParsedRule[] {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  const sheetName = pickRulesSheet(workbook, options.companyName);
  const sheet = workbook.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (aoa.length === 0) return [];

  const isLoja = sheetName.trim().toUpperCase() === "LOJA";
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
  const mapper = isLoja ? rowToRulePositionalLoja : rowToRulePositionalBaifer;
  return aoa
    .slice(start)
    .map(mapper)
    .filter((item): item is ParsedRule => item != null);
}

export function dedupeParsedRules(rules: ParsedRule[]): ParsedRule[] {
  const map = new Map<string, ParsedRule>();
  for (const rule of rules) {
    map.set(`${rule.ncm}::${rule.situacaoCodigo}`, rule);
  }
  return [...map.values()];
}

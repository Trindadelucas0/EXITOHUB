import * as XLSX from "xlsx";
import {
  DESTINO_KEYS,
  DESTINO_LABELS,
  DESTINO_SHORT_LABELS,
  UF_KEYS,
  emptyUfTributacao,
  type DestinosCst,
  type UfKey,
  type UfTributacao,
  type UfTributacaoCell,
} from "@/src/lib/fiscal";
import { normalizeCfop, normalizeNcm } from "./ncm";
import {
  classifySituacao,
  destinosFromCells,
  emptyDestinos,
  parseMvaFields,
} from "./rule-classify";
import { fillMissingUnicaAbreviacao } from "./unica-abreviacao";
import { isEgaplastCompany } from "./company-slug";
import { parseEgaplastCadastroSheets } from "./import-cadastro";
import { rulesFromEgaplastCadastro } from "./egaplast-rules";
import type { IvaPorUf } from "@/src/lib/iva-por-uf";

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
  cest: string | null;
  ipi: string | null;
  /** undefined = coluna ABREVIACAO ausente no arquivo (não apagar no update). */
  abreviacao: string | null | undefined;
  reducao: boolean;
  reducaoPercentual: number | null;
  ufTributacao: UfTributacao | null;
  ivaPorUf: IvaPorUf | null;
  ivaPorUfImportado: IvaPorUf | null;
};

export type ParseRulesOptions = {
  companyName?: string | null;
};

type CompanyHint = "BAIFER" | "LOJA" | "UNICA" | null;

type UnicaColumnMap = {
  headerRow: number;
  ncm: number;
  cest: number | null;
  segmento: number | null;
  descricao: number | null;
  ipi: number | null;
  reducao: number | null;
  reducaoPct: number | null;
  abreviacao: number | null;
  ufs: Partial<Record<UfKey, number>>;
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

function dashToNull(value: unknown): string | null {
  const text = cellStr(value);
  if (!text || text === "-" || text === "–" || text === "—") return null;
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
  if (folded.some((c) => c === "cest") && folded.some((c) => c === "ncm")) return false;
  return (
    folded.some((c) => c === "ncm") &&
    folded.some((c) => c.includes("segment") || c.includes("cfop") || c.includes("situacao"))
  );
}

function looksLikeUnicaGroupRow(cells: unknown[]): boolean {
  const folded = cells.map((c) => foldHeader(cellStr(c)));
  return (
    folded.some((c) => c === "df") &&
    folded.some((c) => c === "go") &&
    folded.some((c) => c === "mg")
  );
}

function looksLikeUnicaHeaderRow(cells: unknown[]): boolean {
  const folded = cells.map((c) => foldHeader(cellStr(c)));
  return folded.some((c) => c === "ncm") && folded.some((c) => c === "cest");
}

function findUnicaColumnMap(aoa: unknown[][]): UnicaColumnMap | null {
  let headerRow = -1;
  let groupRow = -1;
  for (let i = 0; i < Math.min(aoa.length, 8); i++) {
    const row = aoa[i] ?? [];
    if (looksLikeUnicaGroupRow(row)) groupRow = i;
    if (looksLikeUnicaHeaderRow(row)) headerRow = i;
  }
  if (headerRow < 0) return null;
  const header = (aoa[headerRow] ?? []).map((c) => foldHeader(cellStr(c)));
  const ncm = header.findIndex((c) => c === "ncm");
  if (ncm < 0) return null;
  const map: UnicaColumnMap = {
    headerRow,
    ncm,
    cest: header.findIndex((c) => c === "cest"),
    segmento: header.findIndex((c) => c === "segmento"),
    descricao: header.findIndex((c) => c === "descricao" || c === "descrição"),
    ipi: header.findIndex((c) => c === "ipi"),
    reducao: header.findIndex((c) => c === "reducao" || c === "redução"),
    reducaoPct: header.findIndex((c) => c === "%" || c === "% reducao"),
    abreviacao: header.findIndex((c) => c.includes("abreviacao")),
    ufs: {},
  };
  if (map.cest != null && map.cest < 0) map.cest = null;
  if (map.segmento != null && map.segmento < 0) map.segmento = null;
  if (map.descricao != null && map.descricao < 0) map.descricao = null;
  if (map.ipi != null && map.ipi < 0) map.ipi = null;
  if (map.reducao != null && map.reducao < 0) map.reducao = null;
  if (map.reducaoPct != null && map.reducaoPct < 0) map.reducaoPct = null;
  if (map.abreviacao != null && map.abreviacao < 0) map.abreviacao = null;

  const group = groupRow >= 0 ? (aoa[groupRow] ?? []).map((c) => foldHeader(cellStr(c))) : [];
  for (const uf of UF_KEYS) {
    const idx = group.findIndex((c) => c === foldHeader(uf));
    if (idx >= 0) map.ufs[uf] = idx;
  }
  if (!map.ufs.DF && !map.ufs.GO && !map.ufs.MG) {
    const originalIdx = header
      .map((c, i) => (c === "original" ? i : -1))
      .filter((i) => i >= 0);
    if (originalIdx.length >= 3) {
      map.ufs.DF = originalIdx[0];
      map.ufs.GO = originalIdx[1];
      map.ufs.MG = originalIdx[2];
    }
  }
  return map;
}

function looksLikeUnicaAoa(aoa: unknown[][]): boolean {
  return findUnicaColumnMap(aoa) != null;
}

function looksLikeRulesSheet(sheet: XLSX.WorkSheet): boolean {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (aoa.length === 0) return false;
  if (looksLikeUnicaAoa(aoa)) return true;
  for (let i = 0; i < Math.min(aoa.length, 5); i++) {
    if (looksLikeHeaderRow(aoa[i] ?? [])) return true;
  }
  const firstNcm = normalizeNcm(cellStr((aoa[0] ?? [])[0]));
  return firstNcm.length === 8;
}

function shouldSkipSheetName(name: string): boolean {
  const folded = name.trim().toLowerCase();
  if (SKIP_SHEETS.has(folded)) return true;
  if (folded.startsWith("file://") || folded.includes("#")) return true;
  return false;
}

function companySheetHint(companyName: string | null | undefined): CompanyHint {
  const folded = foldHeader(companyName || "");
  if (!folded) return null;
  if (folded.includes("unica")) return "UNICA";
  if (folded.includes("loja")) return "LOJA";
  if (folded.includes("baifer")) return "BAIFER";
  return null;
}

function deriveCstSaida(mappedCst: string | null, destinos: DestinosCst): string | null {
  if (mappedCst) return mappedCst;
  return destinos.atacado || destinos.revenda || destinos.contribuinte || null;
}

function unicaExtras(): Pick<
  ParsedRule,
  "cest" | "ipi" | "abreviacao" | "reducao" | "reducaoPercentual" | "ufTributacao" | "ivaPorUf" | "ivaPorUfImportado"
> {
  return {
    cest: null,
    ipi: null,
    abreviacao: undefined,
    reducao: false,
    reducaoPercentual: null,
    ufTributacao: null,
    ivaPorUf: null,
    ivaPorUfImportado: null,
  };
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
    ...unicaExtras(),
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

function parseReducaoFlag(raw: string | null): boolean {
  if (!raw) return false;
  const folded = foldHeader(raw);
  if (!folded || folded === "-" || folded === "nao" || folded === "0") return false;
  return true;
}

function ufCellFromRow(cells: unknown[], start: number | undefined): UfTributacaoCell {
  if (start == null || start < 0) {
    return { original: null, ajustada4: null, ajustada7: null, ajustada12: null, aliqInterna: null };
  }
  return {
    original: dashToNull(cells[start]),
    ajustada4: dashToNull(cells[start + 1]),
    ajustada7: dashToNull(cells[start + 2]),
    ajustada12: dashToNull(cells[start + 3]),
    aliqInterna: dashToNull(cells[start + 4]),
  };
}

function ufTributacaoFilled(uf: UfTributacao): boolean {
  return UF_KEYS.some((key) => Object.values(uf[key]).some(Boolean));
}

function rowToUnicaRule(raw: unknown[], map: UnicaColumnMap): ParsedRule | null {
  const ncmOriginal = cellStr(raw[map.ncm]);
  const ncm = normalizeNcm(ncmOriginal);
  if (ncm.length !== 8) return null;
  const uf = emptyUfTributacao();
  for (const key of UF_KEYS) {
    uf[key] = ufCellFromRow(raw, map.ufs[key]);
  }
  const mva = parseMvaFields(uf.DF.original);
  const reducaoRaw = map.reducao != null ? dashToNull(raw[map.reducao]) : null;
  const reducaoPctRaw = map.reducaoPct != null ? dashToNull(raw[map.reducaoPct]) : null;
  const reducao = parseReducaoFlag(reducaoRaw);
  const reducaoMva = parseMvaFields(reducaoPctRaw);
  const segmento =
    (map.segmento != null ? dashToNull(raw[map.segmento]) : null) ||
    (map.descricao != null ? dashToNull(raw[map.descricao]) : null) ||
    "";
  return {
    ncm,
    ncmOriginal: ncmOriginal.trim(),
    segmento,
    cstEntrada: null,
    cstSaida: null,
    cfopSaida: null,
    destinosCst: emptyDestinos(),
    situacao: reducao ? "Redução" : "Tributação por UF",
    situacaoCodigo: reducao ? "REDUCAO" : "TRIBUTACAO_UF",
    mvaPercentual: mva.mvaPercentual,
    mvaTexto: mva.mvaTexto,
    mvaKind: mva.mvaKind,
    cest: map.cest != null ? dashToNull(raw[map.cest]) : null,
    ipi: map.ipi != null ? dashToNull(raw[map.ipi]) : null,
    abreviacao: map.abreviacao != null ? dashToNull(raw[map.abreviacao]) : undefined,
    reducao,
    reducaoPercentual: reducaoMva.mvaPercentual,
    ufTributacao: ufTributacaoFilled(uf) ? uf : null,
    ivaPorUf: null,
    ivaPorUfImportado: null,
  };
}

function parseUnicaAoa(
  aoa: unknown[][],
  options: { fillMissingAbreviacao?: boolean } = {},
): ParsedRule[] {
  const map = findUnicaColumnMap(aoa);
  if (!map) return [];
  const parsed = aoa
    .slice(map.headerRow + 1)
    .map((row) => rowToUnicaRule(row ?? [], map))
    .filter((item): item is ParsedRule => item != null);
  if (map.abreviacao != null) return parsed;
  if (options.fillMissingAbreviacao === false) return parsed;
  return fillMissingUnicaAbreviacao(parsed);
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

  if (hint === "UNICA") {
    const named = candidates.find((n) => {
      const folded = foldHeader(n);
      return folded.includes("ncm atualizado") || folded.includes("unica");
    });
    if (named && looksLikeRulesSheet(workbook.Sheets[named])) return named;
    for (const name of candidates) {
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
        header: 1,
        defval: "",
        raw: false,
      });
      if (looksLikeUnicaAoa(aoa)) return name;
    }
  }

  if (hint === "BAIFER" || hint === "LOJA") {
    const exact = candidates.find((n) => n.trim().toUpperCase() === hint);
    if (exact && looksLikeRulesSheet(workbook.Sheets[exact])) return exact;
  }

  for (const preferred of ["BAIFER", "LOJA"] as const) {
    if (hint && hint !== "UNICA" && preferred !== hint) continue;
    if (hint === "UNICA") continue;
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
  if (isEgaplastCompany(options.companyName)) {
    const { dados, relatorio } = parseEgaplastCadastroSheets(workbook, false);
    const fromCadastro = rulesFromEgaplastCadastro(relatorio, dados);
    if (fromCadastro.length > 0) return fromCadastro;
  }
  const sheetName = pickRulesSheet(workbook, options.companyName);
  const sheet = workbook.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (aoa.length === 0) return [];

  if (looksLikeUnicaAoa(aoa)) {
    return parseUnicaAoa(aoa, {
      fillMissingAbreviacao: !isEgaplastCompany(options.companyName),
    });
  }

  const isLoja = sheetName.trim().toUpperCase() === "LOJA";
  const headerIndex = aoa.findIndex((row) => looksLikeHeaderRow(row ?? []));
  if (headerIndex >= 0) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      range: headerIndex,
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

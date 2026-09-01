import path from "node:path";
import * as XLSX from "xlsx";
import type { DestinosCst } from "@/src/lib/fiscal";
import { DESTINO_KEYS } from "@/src/lib/fiscal";
import { isEgaplastCompany } from "./company-slug";
import { joinEgaplastCadastro } from "./egaplast-rules";
import { normalizeCst, normalizeNcm, parseMvaNumber } from "./ncm";

export const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xls", ".csv", ".ods"]);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export type ParsedProduct = {
  codigo: string;
  descricao: string;
  ncm: string;
  ncmOriginal: string;
  aliquotaIcms: string | null;
  ivaMva: string | null;
  ivaMvaNumero: number | null;
  cest: string | null;
  abreviacao: string | null;
  cstCompra: string | null;
  cstUnico: string | null;
  destinosCst: DestinosCst | null;
};

const HEADER_MAP: Record<string, string> = {
  codigo: "codigo",
  código: "codigo",
  code: "codigo",
  "cod.item": "codigo",
  "cod item": "codigo",
  descricao: "descricao",
  descrição: "descricao",
  nome: "descricao",
  "nome do produto": "descricao",
  produto: "descricao",
  ncm: "ncm",
  "novo ncm / classif. ipi": "ncm",
  "novo ncm": "ncm",
  "desc. abrev. icms": "descAbrevIcms",
  cest: "cest",
  aliquota: "aliquotaIcms",
  alíquota: "aliquotaIcms",
  "%icms": "aliquotaIcms",
  icms: "aliquotaIcms",
  iva: "ivaMva",
  mva: "ivaMva",
  "%iva": "ivaMva",
  "%iva compra": "ivaMva",
  "iva compra": "ivaMva",
  cst: "cstUnico",
  "cst venda": "cstUnico",
  "cst saida": "cstUnico",
  "cst saída": "cstUnico",
  "cst baifer": "cstUnico",
  "sit.tributaria": "cstUnico",
  "sit tributaria": "cstUnico",
  "situacao tributaria": "cstUnico",
  "cst compra": "cstCompra",
  "cst entrada": "cstCompra",
  revenda_1: "cstCompra",
  "nao contr": "naoContribuinte",
  "não contr": "naoContribuinte",
  naocontribuinte: "naoContribuinte",
  contrib: "contribuinte",
  contribuinte: "contribuinte",
  revenda: "revenda",
  construt: "construtora",
  construtora: "construtora",
  "hosp/clinica": "hospClinica",
  "hosp/clínica": "hospClinica",
  hospclinica: "hospClinica",
  "orgao pub": "orgaoPublico",
  "órgão púb": "orgaoPublico",
  orgaopublico: "orgaoPublico",
  "prod.rural": "produtorRural",
  prodrural: "produtorRural",
  "produtor rural": "produtorRural",
  atacado: "atacado",
};

const SKIP_SHEETS = new Set(["baifer", "loja", "ncm_geral"]);

function foldHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()À-ÿ]/g, "_");
  return base.slice(0, 120) || "cadastro.xlsx";
}

export function assertSafeUpload(fileName: string, size: number, mime: string): string {
  if (size > MAX_UPLOAD_BYTES) {
    throw new Error("Arquivo excede 8 MB.");
  }
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error("Extensão não permitida. Use XLSX, XLS, CSV ou ODS.");
  }
  if (
    (ext === ".xlsx" || ext === ".xls") &&
    mime &&
    !/spreadsheet|excel|ms-excel|octet-stream|officedocument/i.test(mime)
  ) {
    throw new Error("Tipo de arquivo inválido.");
  }
  return ext;
}

function mapHeader(header: string): string | null {
  const folded = foldHeader(header);
  if (folded === "codigo original" || folded === "marca" || folded === "origem") return null;
  if (folded.includes("iva") && folded.includes("venda")) return null;
  // Desc. Abrev. ICMS = CST + alíquota (não confundir com Abreviação fiscal)
  if (folded.includes("abrev") && folded.includes("icms")) return "descAbrevIcms";
  if (
    folded.includes("abreviacao fiscal") ||
    folded.includes("novo abreviacao fiscal") ||
    folded === "abreviacao" ||
    folded === "novo abreviacao"
  ) {
    return "abreviacao";
  }
  if (folded === "cod.item" || folded === "cod item" || folded.startsWith("cod.")) return "codigo";
  if (folded.includes("sit") && folded.includes("tribut")) return "cstUnico";
  if (HEADER_MAP[folded]) return HEADER_MAP[folded];
  for (const [key, mapped] of Object.entries(HEADER_MAP)) {
    if (key.length < 3) continue;
    if (mapped === "aliquotaIcms" && key === "icms" && folded.includes("abrev")) continue;
    if (folded.includes(key)) return mapped;
  }
  return null;
}

function hasCodigoHeader(folded: string[]): boolean {
  return folded.some(
    (c) => c === "codigo" || c === "cod.item" || c === "cod item" || c.startsWith("cod."),
  );
}

function hasNcmHeader(folded: string[]): boolean {
  return folded.some((c) => c === "ncm" || c.includes("ncm"));
}

function hasNomeHeader(folded: string[]): boolean {
  return folded.some(
    (c) =>
      c === "nome" ||
      c === "nome do produto" ||
      c === "descricao" ||
      c === "produto",
  );
}

function hasSitTributariaHeader(folded: string[]): boolean {
  return folded.some((c) => c.includes("sit") && c.includes("tribut"));
}

export function isCadastroHeader(cells: unknown[]): boolean {
  const folded = cells.map((c) => foldHeader(String(c ?? "")));
  return hasCodigoHeader(folded) && hasNcmHeader(folded) && hasNomeHeader(folded);
}

/** Relatório Egaplast: CÓDIGO + SIT.TRIBUTÁRIA + NCM, sem coluna de nome. */
export function isEgaplastRelatorioHeader(cells: unknown[]): boolean {
  const folded = cells.map((c) => foldHeader(String(c ?? "")));
  return (
    hasCodigoHeader(folded) &&
    hasNcmHeader(folded) &&
    hasSitTributariaHeader(folded) &&
    !hasNomeHeader(folded)
  );
}

/** Extrai CST e alíquota de valores Unica como "010 18 0" / "000 18 0". */
export function parseDescAbrevIcms(raw: string | null | undefined): {
  cstUnico: string | null;
  aliquotaIcms: string | null;
} {
  const text = String(raw ?? "").trim();
  if (!text) return { cstUnico: null, aliquotaIcms: null };
  const match = text.match(/^(\d{1,3})\s+(\d{1,2}(?:[.,]\d+)?)\s+(\d+)\s*$/);
  if (!match) return { cstUnico: null, aliquotaIcms: null };
  return {
    cstUnico: normalizeCst(match[1]),
    aliquotaIcms: match[2].replace(",", "."),
  };
}

/**
 * Converte IVA/MVA com ponto decimal (ex. 1.5763) sem apagar o ponto.
 * Diferente de parseMvaNumber, que trata ponto como milhar.
 */
export function parseIvaDecimal(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const folded = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (folded === "nao" || folded === "não" || folded === "-") return null;
  if (folded.includes("#n/d") || folded.startsWith("sim")) return null;
  let cleaned = text.replace("%", "").trim();
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(",", ".");
  }
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** NCM "0" / vazio não vira 00000000. */
export function ncmFromCadastroCell(raw: string | null | undefined): {
  ncm: string;
  ncmOriginal: string;
} {
  const text = String(raw ?? "").trim();
  if (!text || text === "0" || text === "-" || text === "–" || text === "—") {
    return { ncm: "", ncmOriginal: "" };
  }
  const digits = text.replace(/\D/g, "");
  if (!digits || digits === "0") {
    return { ncm: "", ncmOriginal: "" };
  }
  return { ncm: normalizeNcm(text), ncmOriginal: text };
}

function resolveCsvCodepage(buffer: Buffer): number {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 65001;
  }
  const sample = buffer.subarray(0, Math.min(buffer.length, 240)).toString("latin1");
  if (/Cód\.Item|Descrição|Abreviação/i.test(sample)) return 1252;
  return 65001;
}

export function findHeaderRowIndex(aoa: unknown[][]): number {
  for (let i = 0; i < Math.min(aoa.length, 30); i++) {
    if (isCadastroHeader(aoa[i] ?? []) || isEgaplastRelatorioHeader(aoa[i] ?? [])) return i;
  }
  return 0;
}

export function isJunkRow(codigo: string, descricao: string): boolean {
  const codigoFold = foldHeader(codigo);
  const descFold = foldHeader(descricao);
  const haystack = `${codigoFold} ${descFold}`.trim();
  if (!haystack) return true;
  if (
    /filtros selecionados|grupo fiscal|^estado\b|^df -|ativo\s*\.+|data de cadastro/.test(
      haystack,
    )
  ) {
    return true;
  }
  // Títulos de listagem Egaplast ficam na coluna código — não filtrar "EGAPLAST" no nome do produto.
  if (
    /egaplast artefatos|listagem cadastral|sistema de gestao|total de produtos|^pag\./.test(
      codigoFold,
    )
  ) {
    return true;
  }
  if (codigoFold === "codigo" || codigoFold === "código") return true;
  if (
    /^\d+\s*-\s*(atacado|revenda|contrib|nao contr|construt|hosp|orgao|prod)/.test(
      codigoFold,
    )
  ) {
    return true;
  }
  if (
    /^(nao contr|contrib|revenda|construt|hosp\/clinica|orgao pub|prod\.rural|atacado)$/.test(
      codigoFold,
    )
  ) {
    return true;
  }
  return false;
}

function sheetLooksLikeCadastro(sheet: XLSX.WorkSheet, raw: boolean): boolean {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw });
  const idx = findHeaderRowIndex(aoa);
  const row = aoa[idx] ?? [];
  return isCadastroHeader(row) || isEgaplastRelatorioHeader(row);
}

function shouldSkipCadastroSheetName(name: string): boolean {
  const folded = name.trim().toLowerCase();
  if (SKIP_SHEETS.has(folded)) return true;
  if (folded.startsWith("file://") || folded.includes("#")) return true;
  return false;
}

/** Escolhe a aba Santri/Egaplast (cadastro) e ignora BAIFER/LOJA/NCM_GERAL/links. */
export function pickCadastroSheet(workbook: XLSX.WorkBook, raw: boolean): string {
  const names = workbook.SheetNames.filter((n) => !shouldSkipCadastroSheetName(n));
  for (const name of names) {
    if (sheetLooksLikeCadastro(workbook.Sheets[name], raw)) return name;
  }
  if (names.length === 0) {
    throw new Error("Nenhuma aba de cadastro válida no arquivo (abas BAIFER/LOJA não são cadastro).");
  }
  return names[0];
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function findColumnIndexes(header: unknown[]): {
  codigo: number;
  ncm: number;
  sit: number;
} {
  const folded = header.map((c) => foldHeader(String(c ?? "")));
  const codigo = folded.findIndex(
    (c) => c === "codigo" || c === "cod.item" || c === "cod item" || c.startsWith("cod."),
  );
  const ncm = folded.findIndex((c) => c === "ncm" || c.includes("ncm"));
  const sit = folded.findIndex((c) => c.includes("sit") && c.includes("tribut"));
  return { codigo, ncm, sit };
}

function parseIvaBlockFromRows(rows: unknown[][]): { ivaMva: string | null; ivaMvaNumero: number | null } {
  const byUf: Record<string, string> = {};
  for (const row of rows) {
    const label = foldHeader(cellStr(row[1]));
    if (!label.includes("iva")) continue;
    for (let j = 2; j < row.length - 1; j += 2) {
      const uf = cellStr(row[j]).toUpperCase();
      const val = cellStr(row[j + 1]);
      if (/^[A-Z]{2}$/.test(uf) && val) byUf[uf] = val;
    }
  }
  const sp = byUf.SP;
  const spNum = parseIvaDecimal(sp);
  if (spNum != null && spNum > 0) {
    return { ivaMva: sp, ivaMvaNumero: spNum };
  }
  for (const uf of Object.keys(byUf).sort()) {
    const num = parseIvaDecimal(byUf[uf]);
    if (num != null && num > 0) {
      return { ivaMva: byUf[uf], ivaMvaNumero: num };
    }
  }
  return { ivaMva: null, ivaMvaNumero: null };
}

/** Layout relatório Egaplast: bloco código + 4 linhas IVA/ICM por UF. */
export function parseEgaplastRelatorioAoa(aoa: unknown[][]): ParsedProduct[] {
  const headerIdx = aoa.findIndex((row) => isEgaplastRelatorioHeader(row ?? []));
  if (headerIdx < 0) return [];
  const cols = findColumnIndexes(aoa[headerIdx] ?? []);
  if (cols.codigo < 0 || cols.ncm < 0 || cols.sit < 0) return [];

  const products: ParsedProduct[] = [];
  const seen = new Set<string>();

  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = aoa[i] ?? [];
    const codigo = cellStr(row[cols.codigo]);
    if (!codigo) continue;
    if (foldHeader(codigo) === "codigo") continue;
    if (isJunkRow(codigo, "")) continue;
    // Linha de produto: tem sit.tributária preenchida na coluna
    const sitRaw = cellStr(row[cols.sit]);
    if (!sitRaw) continue;
    if (foldHeader(sitRaw).includes("sit") && foldHeader(sitRaw).includes("tribut")) continue;

    const ncmRaw = cellStr(row[cols.ncm]);
    const { ncm, ncmOriginal } = ncmFromCadastroCell(ncmRaw);
    const cstUnico = normalizeCst(sitRaw);
    const ivaRows: unknown[][] = [];
    for (let k = 1; k <= 4 && i + k < aoa.length; k++) {
      const next = aoa[i + k] ?? [];
      if (foldHeader(cellStr(next[1])).includes("iva")) ivaRows.push(next);
    }
    const iva = parseIvaBlockFromRows(ivaRows);
    const dedupeKey = `${codigo}::${ncm}::${cstUnico ?? ""}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    products.push({
      codigo,
      descricao: codigo,
      ncm,
      ncmOriginal,
      aliquotaIcms: null,
      ivaMva: iva.ivaMva,
      ivaMvaNumero: iva.ivaMvaNumero,
      cest: null,
      abreviacao: null,
      cstCompra: null,
      cstUnico,
      destinosCst: null,
    });
  }
  return products;
}

export type ParseCadastroOptions = {
  companyName?: string | null;
};

function parseCadastroSheetProducts(
  sheet: XLSX.WorkSheet,
  aoa: unknown[][],
  raw: boolean,
): ParsedProduct[] {
  const relatorioHeader = aoa.findIndex((row) => isEgaplastRelatorioHeader(row ?? []));
  if (relatorioHeader >= 0 && !isCadastroHeader(aoa[relatorioHeader] ?? [])) {
    return parseEgaplastRelatorioAoa(aoa);
  }
  const headerRow = findHeaderRowIndex(aoa);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: headerRow,
    defval: "",
    raw,
  });
  return rows.map((row) => toProduct(row)).filter((item): item is ParsedProduct => item != null);
}

function parseEgaplastCadastroWorkbook(workbook: XLSX.WorkBook, raw: boolean): ParsedProduct[] | null {
  const names = workbook.SheetNames.filter((n) => !shouldSkipCadastroSheetName(n));
  let dados: ParsedProduct[] | null = null;
  let relatorio: ParsedProduct[] | null = null;
  for (const name of names) {
    const sheet = workbook.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw });
    const idx = findHeaderRowIndex(aoa);
    const header = aoa[idx] ?? [];
    if (isEgaplastRelatorioHeader(header) && !isCadastroHeader(header)) {
      relatorio = parseEgaplastRelatorioAoa(aoa);
      continue;
    }
    if (isCadastroHeader(header)) {
      dados = parseCadastroSheetProducts(sheet, aoa, raw);
    }
  }
  if (dados && relatorio) return joinEgaplastCadastro(dados, relatorio);
  if (dados) return dados;
  if (relatorio) return relatorio;
  return null;
}

export function parseCadastroBuffer(
  buffer: Buffer,
  ext: string,
  options: ParseCadastroOptions = {},
): ParsedProduct[] {
  const isCsv = ext.toLowerCase() === ".csv";
  const raw = isCsv;
  const readOpts: XLSX.ParsingOptions = { type: "buffer", raw };
  if (isCsv) readOpts.codepage = resolveCsvCodepage(buffer);

  const workbook = XLSX.read(buffer, readOpts);
  if (isEgaplastCompany(options.companyName)) {
    const joined = parseEgaplastCadastroWorkbook(workbook, raw);
    if (joined) return joined;
  }
  const sheetName = pickCadastroSheet(workbook, raw);
  const sheet = workbook.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw });
  return parseCadastroSheetProducts(sheet, aoa, raw);
}

/** Abas Dados + Planilha1 para montar a regra Egaplast. */
export function parseEgaplastCadastroSheets(
  workbook: XLSX.WorkBook,
  raw = false,
): { dados: ParsedProduct[]; relatorio: ParsedProduct[] } {
  const names = workbook.SheetNames.filter((n) => !shouldSkipCadastroSheetName(n));
  let dados: ParsedProduct[] = [];
  let relatorio: ParsedProduct[] = [];
  for (const name of names) {
    const sheet = workbook.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw });
    const idx = findHeaderRowIndex(aoa);
    const header = aoa[idx] ?? [];
    if (isEgaplastRelatorioHeader(header) && !isCadastroHeader(header)) {
      relatorio = parseEgaplastRelatorioAoa(aoa);
      continue;
    }
    if (isCadastroHeader(header)) {
      dados = parseCadastroSheetProducts(sheet, aoa, raw);
    }
  }
  return { dados, relatorio };
}

function toProduct(row: Record<string, unknown>): ParsedProduct | null {
  const mapped: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const dest = mapHeader(key);
    if (!dest) continue;
    if (mapped[dest]) continue;
    mapped[dest] = String(value ?? "").trim();
  }
  const codigo = mapped.codigo;
  const descricao = mapped.descricao || "";
  const ncmCell = mapped.ncm || "";
  if (isJunkRow(codigo || "", descricao)) return null;
  if (!codigo && !descricao && !ncmCell) return null;
  if (!codigo) return null;

  const fromAbrev = parseDescAbrevIcms(mapped.descAbrevIcms);
  const aliquotaIcms = mapped.aliquotaIcms || null;
  const cstUnico = normalizeCst(mapped.cstUnico) ?? fromAbrev.cstUnico;
  const { ncm, ncmOriginal } = ncmFromCadastroCell(ncmCell);

  const destinos: DestinosCst = {
    naoContribuinte: mapped.naoContribuinte || null,
    contribuinte: mapped.contribuinte || null,
    revenda: mapped.revenda || null,
    construtora: mapped.construtora || null,
    hospClinica: mapped.hospClinica || null,
    orgaoPublico: mapped.orgaoPublico || null,
    produtorRural: mapped.produtorRural || null,
    atacado: mapped.atacado || null,
  };
  const filled = DESTINO_KEYS.filter((k) => destinos[k]).length;

  const ivaRaw = mapped.ivaMva || null;
  const ivaNum = ivaRaw != null ? parseIvaDecimal(ivaRaw) ?? parseMvaNumber(ivaRaw) : null;

  return {
    codigo,
    descricao: descricao || codigo,
    ncm,
    ncmOriginal,
    aliquotaIcms,
    ivaMva: ivaRaw,
    ivaMvaNumero: ivaNum,
    cest: mapped.cest || null,
    abreviacao: mapped.abreviacao || null,
    cstCompra: normalizeCst(mapped.cstCompra),
    cstUnico,
    destinosCst: filled > 0 ? destinos : null,
  };
}

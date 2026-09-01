import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { parseEgaplastCadastroSheets } from "../src/server/import-cadastro";
import { rulesFromEgaplastCadastro } from "../src/server/egaplast-rules";
import { dedupeParsedRules, parseRulesBuffer } from "../src/server/import-rules";

const ROOT = process.cwd();
const DESKTOP = path.join("C:", "Users", "trind", "Desktop", "planilha egaplast.xls");
const DADOS_FIXTURE = path.join(ROOT, "tests", "fixtures", "cadastro-egaplast-ncm-2026-08-27.xls");
const TRIB_FIXTURE = path.join(
  ROOT,
  "tests",
  "fixtures",
  "cadastro-egaplast-relatorio-produtos.xlsx",
);
const DEST = process.argv[2] || path.join(ROOT, "data", "base-egaplast.json");

function loadWorkbook(): { buffer: Buffer; source: string } {
  const fromArg = process.argv[3];
  if (fromArg && existsSync(fromArg)) {
    return { buffer: readFileSync(fromArg), source: path.basename(fromArg) };
  }
  if (existsSync(DESKTOP)) {
    return { buffer: readFileSync(DESKTOP), source: path.basename(DESKTOP) };
  }
  const dados = XLSX.read(readFileSync(DADOS_FIXTURE), { type: "buffer", raw: false });
  const trib = XLSX.read(readFileSync(TRIB_FIXTURE), { type: "buffer", raw: false });
  const merged = XLSX.utils.book_new();
  const dadosSheet = dados.Sheets[dados.SheetNames.find((n) => n === "Dados") ?? dados.SheetNames[0]];
  const tribSheet = trib.Sheets[trib.SheetNames.find((n) => n === "Planilha1") ?? trib.SheetNames[0]];
  if (dadosSheet) XLSX.utils.book_append_sheet(merged, dadosSheet, "Dados");
  if (tribSheet) XLSX.utils.book_append_sheet(merged, tribSheet, "Planilha1");
  const buffer = Buffer.from(XLSX.write(merged, { type: "buffer", bookType: "xlsx" }));
  return { buffer, source: "fixtures-dados+relatorio" };
}

function main() {
  const { buffer, source } = loadWorkbook();
  const parsed = dedupeParsedRules(parseRulesBuffer(buffer, { companyName: "Egaplast" }));
  if (parsed.length === 0) {
    throw new Error(`Nenhuma regra Egaplast reconhecida em ${source}`);
  }
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  const sheets = parseEgaplastCadastroSheets(workbook, false);
  const rebuilt = rulesFromEgaplastCadastro(sheets.relatorio, sheets.dados);
  if (rebuilt.length !== parsed.length) {
    throw new Error(`Parser divergiu: parseRulesBuffer ${parsed.length} vs sheets ${rebuilt.length}`);
  }
  const counts: Record<string, number> = {};
  for (const rule of parsed) {
    counts[rule.situacaoCodigo] = (counts[rule.situacaoCodigo] ?? 0) + 1;
  }
  const payload = {
    company: "egaplast",
    source,
    sheet: "Planilha1+Dados",
    extractedSheets: workbook.SheetNames,
    ignoredSheets: [],
    totalRules: parsed.length,
    uniqueNcm: new Set(parsed.map((r) => r.ncm)).size,
    counts,
    rules: parsed.map((rule) => ({
      company: "egaplast",
      sourceFile: source,
      sourceSheet: rule.situacaoCodigo === "INCOMPLETA" ? "Dados" : "Planilha1",
      ncm: rule.ncm,
      ncmOriginal: rule.ncmOriginal,
      segmento: rule.segmento,
      cstEntrada: rule.cstEntrada,
      cstSaida: rule.cstSaida,
      cfopSaida: rule.cfopSaida,
      destinosCst: rule.destinosCst,
      situacao: rule.situacao,
      situacaoCodigo: rule.situacaoCodigo,
      mvaPercentual: rule.mvaPercentual,
      mvaTexto: rule.mvaTexto,
      mvaKind: rule.mvaKind,
      observacao: null,
      cest: rule.cest,
      ipi: rule.ipi,
      abreviacao: rule.abreviacao ?? null,
      reducao: rule.reducao,
      reducaoPercentual: rule.reducaoPercentual,
      ufTributacao: rule.ufTributacao,
      ivaPorUf: rule.ivaPorUf,
      ivaPorUfImportado: rule.ivaPorUfImportado,
    })),
  };
  writeFileSync(DEST, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Egaplast ${payload.source}: ${payload.totalRules} regras ${JSON.stringify(counts)}`);
}

main();

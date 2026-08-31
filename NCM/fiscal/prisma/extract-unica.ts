import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dedupeParsedRules, parseRulesBuffer } from "../src/server/import-rules";

const ROOT = process.cwd();
const DEFAULT_SOURCE_SHEET = "Planilha3";
const FIXTURE =
  process.argv[2] ||
  path.join(ROOT, "tests", "fixtures", "tributacao-ncm-unica-atacadista-2026-08-27.xlsx");
const DEST = process.argv[3] || path.join(ROOT, "data", "base-unica.json");

function main() {
  const buffer = readFileSync(FIXTURE);
  const parsed = dedupeParsedRules(parseRulesBuffer(buffer, { companyName: "Unica" }));
  if (parsed.length === 0) {
    throw new Error(`Nenhuma regra Unica reconhecida em ${FIXTURE}`);
  }
  const counts: Record<string, number> = {};
  for (const rule of parsed) {
    counts[rule.situacaoCodigo] = (counts[rule.situacaoCodigo] ?? 0) + 1;
  }
  const sourceSheet = DEFAULT_SOURCE_SHEET;
  const payload = {
    company: "unica",
    source: path.basename(FIXTURE),
    sheet: sourceSheet,
    extractedSheets: [sourceSheet],
    ignoredSheets: [],
    totalRules: parsed.length,
    uniqueNcm: new Set(parsed.map((r) => r.ncm)).size,
    counts,
    rules: parsed.map((rule) => ({
      company: "unica",
      sourceFile: path.basename(FIXTURE),
      sourceSheet,
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
    })),
  };
  writeFileSync(DEST, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Unica ${payload.source}: ${payload.totalRules} regras ${JSON.stringify(counts)}`);
}

main();

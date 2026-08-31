import { readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { pickCadastroSheet, parseCadastroBuffer } from "./import-cadastro";
import { dedupeParsedRules, parseRulesBuffer, pickRulesSheet } from "./import-rules";
import { classifySituacao, parseMvaFields } from "./rule-classify";
import { isValidSlug, normalizeSlug } from "./company-slug";

const FIXTURE = path.join(process.cwd(), "tests", "fixtures", "ncm-atualizado.ods");

describe("slug de empresa", () => {
  it("normaliza acento e espaços", () => {
    expect(normalizeSlug(" Loja das Máquinas ")).toBe("loja-das-maquinas");
    expect(isValidSlug("baifer")).toBe(true);
    expect(isValidSlug("Loja")).toBe(false);
  });
});

describe("classificação de situação", () => {
  it("reconhece textos e fallbacks de CST/CFOP", () => {
    expect(classifySituacao("ST Interno", "10", "5403")).toBe("ST_INTERNO");
    expect(classifySituacao("ST Nacional", "60", "5405")).toBe("ST_NACIONAL");
    expect(classifySituacao("Redução", "20", "5102")).toBe("REDUCAO");
    expect(classifySituacao("", "00", "5102")).toBe("REGRA_GERAL");
    expect(classifySituacao("", "", "")).toBe("INCOMPLETA");
  });
});

describe("MVA de regra", () => {
  it("converte percentual e marca análise", () => {
    expect(parseMvaFields(0.4).mvaKind).toBe("numeric");
    expect(parseMvaFields("não").mvaKind).toBe("skip");
    expect(parseMvaFields("-").mvaKind).toBe("skip");
    expect(parseMvaFields("#N/D").mvaKind).toBe("analise");
  });
});

describe("parser de planilha de regras", () => {
  it("lê CSV posicional e remove duplicata", () => {
    const csv = [
      "32141010,Tintas,00,00,5102,00,00,00,00,00,00,00,00,Regra geral,40",
      "32141010,Tintas,00,00,5102,00,00,00,00,00,00,00,00,Regra geral,41",
      "abc,x,00,00,5102,00,00,00,00,00,00,00,00,Regra geral,40",
    ].join("\n");
    const rules = dedupeParsedRules(parseRulesBuffer(Buffer.from(csv, "utf8")));
    expect(rules).toHaveLength(1);
    expect(rules[0]?.ncm).toBe("32141010");
    expect(rules[0]?.situacaoCodigo).toBe("REGRA_GERAL");
  });
});

describe("calibração NCM ATUALIZADO.ods", () => {
  const buffer = readFileSync(FIXTURE);

  it("escolhe aba BAIFER ou LOJA conforme a empresa", () => {
    const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
    expect(pickRulesSheet(workbook, "BAIFER")).toBe("BAIFER");
    expect(pickRulesSheet(workbook, "Loja das Máquinas")).toBe("LOJA");
    expect(pickCadastroSheet(workbook, false)).toBe("Planilha_Classes_Fiscais");
  });

  it("importa regras BAIFER com matriz 32141010", () => {
    const rules = parseRulesBuffer(buffer, { companyName: "BAIFER" });
    expect(rules.length).toBeGreaterThanOrEqual(1045);
    const gold = rules.find((r) => r.ncm === "32141010");
    expect(gold).toBeTruthy();
    expect(gold?.cstEntrada).toBe("0");
    expect(gold?.cstSaida).toBe("10");
    expect(gold?.cfopSaida).toBe("5403");
    expect(gold?.situacaoCodigo).toBe("ST_INTERNO");
    expect(gold?.destinosCst.naoContribuinte).toBe("0");
    expect(gold?.destinosCst.contribuinte).toBe("10");
    expect(gold?.destinosCst.revenda).toBe("10");
    expect(gold?.destinosCst.construtora).toBe("0");
    expect(gold?.destinosCst.hospClinica).toBe("0");
    expect(gold?.destinosCst.orgaoPublico).toBe("0");
    expect(gold?.destinosCst.produtorRural).toBe("0");
    expect(gold?.destinosCst.atacado).toBe("10");
    expect(gold?.mvaPercentual).toBeCloseTo(29.72, 1);
  });

  it("importa regras LOJA sem misturar CST BAIFER e normaliza CFOP 5.405", () => {
    const rules = parseRulesBuffer(buffer, { companyName: "Loja das Máquinas" });
    expect(rules.length).toBeGreaterThanOrEqual(1045);
    const gold = rules.find((r) => r.ncm === "32141010");
    expect(gold).toBeTruthy();
    expect(gold?.cfopSaida).toBe("5102");
    expect(gold?.situacaoCodigo).toBe("ST_INTERNO");
    expect(gold?.cstSaida).not.toBe("10");
    expect(gold?.destinosCst.revenda).toMatch(/^0+$/);

    const stNacional = rules.find((r) => r.cfopSaida === "5405");
    expect(stNacional).toBeTruthy();
  });

  it("mesmo ODS não mistura empresas nas regras", () => {
    const baifer = parseRulesBuffer(buffer, { companyName: "BAIFER" });
    const loja = parseRulesBuffer(buffer, { companyName: "Loja das Máquinas" });
    const b = baifer.find((r) => r.ncm === "32141010");
    const l = loja.find((r) => r.ncm === "32141010");
    expect(b?.cfopSaida).toBe("5403");
    expect(l?.cfopSaida).toBe("5102");
    expect(b?.cstSaida).toBe("10");
    expect(l?.cstSaida).not.toBe("10");
  });

  it("importa cadastro Santri da aba Planilha_Classes_Fiscais", () => {
    const products = parseCadastroBuffer(buffer, ".ods");
    expect(products.length).toBeGreaterThanOrEqual(1100);
    expect(products.length).toBeLessThanOrEqual(1200);
    const masked = products.find((p) => p.ncmOriginal.includes("82032010"));
    expect(masked?.ncm).toBe("82032010");
    const withNcm = products.filter((p) => p.ncm.length === 8);
    expect(withNcm.length).toBeGreaterThan(1000);
  });
});

const BAIFER_XLSX = path.join(process.cwd(), "tests", "fixtures", "tributacao-ncm-baifer-2026-08-07.xlsx");
const LOJA_XLSX = path.join(process.cwd(), "tests", "fixtures", "tributacao-ncm-lojao-2026-06-28.xlsx");
const UNICA_XLSX = path.join(process.cwd(), "tests", "fixtures", "planilha-regra-fiscal-unica.xlsx");
const UNICA_ATACADISTA_XLSX = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "tributacao-ncm-unica-atacadista-2026-08-27.xlsx",
);

describe("calibração XLSX BAIFER Planilha1", () => {
  const buffer = readFileSync(BAIFER_XLSX);

  it("escolhe Planilha1 e não descarta por nome", () => {
    const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
    expect(pickRulesSheet(workbook, "BAIFER")).toBe("Planilha1");
  });

  it("importa ouro 32141010 igual ao ODS", () => {
    const rules = parseRulesBuffer(buffer, { companyName: "BAIFER" });
    expect(rules.length).toBeGreaterThanOrEqual(1045);
    const gold = rules.find((r) => r.ncm === "32141010");
    expect(gold?.cstEntrada).toBe("0");
    expect(gold?.cstSaida).toBe("10");
    expect(gold?.cfopSaida).toBe("5403");
    expect(gold?.situacaoCodigo).toBe("ST_INTERNO");
    expect(gold?.destinosCst.revenda).toBe("10");
    expect(gold?.destinosCst.naoContribuinte).toBe("0");
    expect(gold?.destinosCst.atacado).toBe("10");
    expect(gold?.mvaPercentual).toBeCloseTo(29.72, 1);
  });
});

describe("calibração XLSX Lojão Planilha1", () => {
  const buffer = readFileSync(LOJA_XLSX);

  it("escolhe Planilha1 e normaliza CFOP 5,405", () => {
    const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
    expect(pickRulesSheet(workbook, "Loja das Máquinas")).toBe("Planilha1");
    const rules = parseRulesBuffer(buffer, { companyName: "Loja das Máquinas" });
    expect(rules.length).toBeGreaterThanOrEqual(1045);
    const gold = rules.find((r) => r.ncm === "32141010");
    expect(gold?.cfopSaida).toBe("5102");
    expect(gold?.situacaoCodigo).toBe("ST_INTERNO");
    expect(gold?.cstSaida).not.toBe("10");
    expect(gold?.destinosCst.revenda).toMatch(/^0+$/);
    const stNacional = rules.find((r) => r.cfopSaida === "5405");
    expect(stNacional).toBeTruthy();
  });
});

describe("calibração planilha Unica UF", () => {
  it("lê 125 NCMs e ouro 25202090 / 32041700", () => {
    const rules = parseRulesBuffer(readFileSync(UNICA_XLSX), { companyName: "Unica" });
    expect(rules.length).toBe(125);
    expect(pickRulesSheet(XLSX.read(readFileSync(UNICA_XLSX), { type: "buffer", raw: false }), "Unica")).toBe(
      "NCM ATUALIZADO ",
    );

    const emptyCest = rules.find((r) => r.ncm === "25202090");
    expect(emptyCest?.cest).toBeNull();
    expect(emptyCest?.abreviacao).toBeUndefined();
    expect(emptyCest?.situacaoCodigo).toBe("TRIBUTACAO_UF");
    expect(emptyCest?.cstSaida).toBeNull();
    expect(emptyCest?.cfopSaida).toBeNull();
    expect(emptyCest?.ufTributacao?.DF.aliqInterna).toBe("20%");
    expect(emptyCest?.ufTributacao?.GO.aliqInterna).toBe("19%");
    expect(emptyCest?.ufTributacao?.MG.aliqInterna).toBe("18%");
    expect(emptyCest?.ufTributacao?.DF.original).toBeNull();
    expect(emptyCest?.mvaKind).toBe("skip");

    const tinta = rules.find((r) => r.ncm === "32041700");
    expect(tinta?.cest).toBe("24000200");
    expect(tinta?.ufTributacao?.DF.original).toBe("50%");
    expect(tinta?.ufTributacao?.GO.original).toBe("50%");
    expect(tinta?.ufTributacao?.MG.original).toBe("64.68%");
    expect(tinta?.mvaPercentual).toBeCloseTo(50, 1);
  });

  it("planilha Unica sem coluna ABREVIACAO deixa abreviacao undefined", () => {
    const rules = parseRulesBuffer(readFileSync(UNICA_XLSX), { companyName: "Unica" });
    expect(rules.length).toBe(125);
    expect(rules.every((r) => r.abreviacao === undefined)).toBe(true);
  });

  it("variante atacadista traz ABREVIACAO e os mesmos NCMs", () => {
    const canon = parseRulesBuffer(readFileSync(UNICA_XLSX), { companyName: "Unica" });
    const atac = parseRulesBuffer(readFileSync(UNICA_ATACADISTA_XLSX), { companyName: "Unica" });
    expect(pickRulesSheet(XLSX.read(readFileSync(UNICA_ATACADISTA_XLSX), { type: "buffer", raw: false }), "Unica")).toBe(
      "Planilha3",
    );
    expect(atac.length).toBe(canon.length);
    expect(atac.map((r) => r.ncm).sort()).toEqual(canon.map((r) => r.ncm).sort());
    const first = atac.find((r) => r.ncm === "25202090");
    expect(first?.abreviacao).toBe("4");
    expect(atac.find((r) => r.ncm === "27101230")?.abreviacao).toBe("3");
    expect(atac.find((r) => r.ncm === "27150000")?.abreviacao).toBe("2");
    expect(first?.cest).toBeNull();
    expect(first?.ufTributacao?.MG.aliqInterna).toBe("18%");
  });
});

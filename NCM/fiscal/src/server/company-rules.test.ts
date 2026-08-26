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

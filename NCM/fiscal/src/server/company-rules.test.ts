import { describe, expect, it } from "vitest";
import { isValidSlug, normalizeSlug } from "./company-slug";
import { classifySituacao, parseMvaFields } from "./rule-classify";
import { parseRulesBuffer, dedupeParsedRules } from "./import-rules";

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

import { readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { pickCadastroSheet, parseCadastroBuffer } from "./import-cadastro";
import { dedupeParsedRules, parseRulesBuffer, pickRulesSheet } from "./import-rules";
import { classifySituacao, parseMvaFields } from "./rule-classify";
import { isValidSlug, isEgaplastCompany, normalizeSlug } from "./company-slug";

const FIXTURE = path.join(process.cwd(), "tests", "fixtures", "ncm-atualizado.ods");

describe("slug de empresa", () => {
  it("normaliza acento e espaços", () => {
    expect(normalizeSlug(" Loja das Máquinas ")).toBe("loja-das-maquinas");
    expect(isValidSlug("baifer")).toBe(true);
    expect(isValidSlug("Loja")).toBe(false);
  });

  it("reconhece só a empresa Egaplast", () => {
    expect(isEgaplastCompany("Egaplast")).toBe(true);
    expect(isEgaplastCompany("egaplast")).toBe(true);
    expect(isEgaplastCompany("BAIFER")).toBe(false);
    expect(isEgaplastCompany("Unica")).toBe(false);
    expect(isEgaplastCompany("Loja das Máquinas")).toBe(false);
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
    expect(emptyCest?.abreviacao).toBe("4");
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

  it("planilha Unica sem coluna ABREVIACAO preenche Abrev. da base Atacadista", () => {
    const rules = parseRulesBuffer(readFileSync(UNICA_XLSX), { companyName: "Unica" });
    expect(rules.length).toBe(125);
    expect(rules.find((r) => r.ncm === "25202090")?.abreviacao).toBe("4");
    expect(rules.find((r) => r.ncm === "27101230")?.abreviacao).toBe("3");
    expect(rules.find((r) => r.ncm === "27150000")?.abreviacao).toBe("2");
    expect(rules.every((r) => typeof r.abreviacao === "string" && r.abreviacao.length > 0)).toBe(true);
  });

  it("NCM Unica fora da base Atacadista continua sem Abrev. se a coluna não existe", () => {
    const aoa = [
      ["", "", "", "", "", "", "", "DF", "", "", "", "", "GO", "", "", "", "", "MG"],
      [
        "NCM",
        "CEST",
        "SEGMENTO",
        "DESCRIÇÃO",
        "IPI",
        "REDUÇÃO",
        "%",
        "Original",
        "Ajustada 4%",
        "Ajustada 7%",
        "Ajustada 12%",
        "Aliq. Interna",
        "Original",
        "Ajustada 4%",
        "Ajustada 7%",
        "Ajustada 12%",
        "Aliq. Interna",
        "Original",
        "Ajustada 4%",
        "Ajustada 7%",
        "Ajustada 12%",
        "Aliq. Interna",
      ],
      [
        "99999999",
        "-",
        "Teste",
        "",
        "",
        "",
        "",
        "-",
        "-",
        "-",
        "-",
        "20%",
        "-",
        "-",
        "-",
        "-",
        "19%",
        "-",
        "-",
        "-",
        "-",
        "18%",
      ],
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), "NCM ATUALIZADO ");
    const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
    const rules = parseRulesBuffer(buffer, { companyName: "Unica" });
    expect(rules).toHaveLength(1);
    expect(rules[0]?.ncm).toBe("99999999");
    expect(rules[0]?.abreviacao).toBeUndefined();
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

const EGAPLAST_DADOS = path.join(process.cwd(), "tests", "fixtures", "cadastro-egaplast-ncm-2026-08-27.xls");
const EGAPLAST_TRIB = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "cadastro-egaplast-relatorio-produtos.xlsx",
);

function mergeEgaplastWorkbook(): Buffer {
  const dados = XLSX.read(readFileSync(EGAPLAST_DADOS), { type: "buffer", raw: false });
  const trib = XLSX.read(readFileSync(EGAPLAST_TRIB), { type: "buffer", raw: false });
  const merged = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(merged, dados.Sheets["Dados"] ?? dados.Sheets[dados.SheetNames[0]], "Dados");
  XLSX.utils.book_append_sheet(
    merged,
    trib.Sheets["Planilha1"] ?? trib.Sheets[trib.SheetNames[0]],
    "Planilha1",
  );
  return Buffer.from(XLSX.write(merged, { type: "buffer", bookType: "xlsx" }));
}

describe("calibração regras Egaplast", () => {
  it("só com companyName Egaplast lê as duas abas", () => {
    const buffer = mergeEgaplastWorkbook();
    const rules = dedupeParsedRules(parseRulesBuffer(buffer, { companyName: "Egaplast" }));
    expect(rules.length).toBe(283);
    const st = rules.find((r) => r.ncm === "39172900" && r.situacaoCodigo === "ST_INTERNO");
    expect(st?.cstSaida).toBe("10");
    expect(st?.cfopSaida).toBeNull();
    expect(st?.segmento).toBe("Plásticos e suas obras");
    expect(st?.mvaPercentual).toBeGreaterThan(0);
    const tributado = rules.find((r) => r.ncm === "32064990");
    expect(tributado?.cstSaida).toBe("0");
    expect(tributado?.situacaoCodigo).toBe("REGRA_GERAL");
    const dual = rules.filter((r) => r.ncm === "84818019");
    expect(dual.map((r) => r.situacaoCodigo).sort()).toEqual(["REGRA_GERAL", "ST_INTERNO"]);
    expect(rules.some((r) => r.situacaoCodigo === "INCOMPLETA")).toBe(true);
  });

  it("BAIFER/Unica não usam o parser Egaplast no mesmo arquivo", () => {
    const buffer = mergeEgaplastWorkbook();
    const baifer = parseRulesBuffer(buffer, { companyName: "BAIFER" });
    const unica = parseRulesBuffer(buffer, { companyName: "Unica" });
    expect(baifer.find((r) => r.ncm === "39172900" && r.situacaoCodigo === "ST_INTERNO")).toBeFalsy();
    expect(unica.find((r) => r.ncm === "25202090")).toBeFalsy();
  });
});

const EGAPLAST_TRIBUTACAO = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "tributacao-ncm-egaplast-2026-08-31.xlsx",
);

describe("import TRIBUTACAO NCM Egaplast", () => {
  it("lê NCM/CEST/segmento/UF só com companyName Egaplast", () => {
    const buffer = readFileSync(EGAPLAST_TRIBUTACAO);
    const rules = dedupeParsedRules(parseRulesBuffer(buffer, { companyName: "Egaplast" }));
    expect(rules.length).toBeGreaterThanOrEqual(300);
    const gold = rules.find((r) => r.ncm === "18063110");
    expect(gold?.situacaoCodigo).toBe("TRIBUTACAO_UF");
    expect(gold?.cest).toBe("23.002.00");
    expect(gold?.segmento).toMatch(/sorvete/i);
    expect(gold?.ufTributacao?.DF.aliqInterna).toBe("20%");
    expect(gold?.ufTributacao?.DF.original).toBe("328%");
    expect(gold?.abreviacao).toBeUndefined();
  });

  it("não preenche Abrev. da Unica na tributação Egaplast", () => {
    const buffer = readFileSync(EGAPLAST_TRIBUTACAO);
    const egaplast = parseRulesBuffer(buffer, { companyName: "Egaplast" });
    expect(egaplast.some((r) => r.abreviacao)).toBe(false);
  });
});

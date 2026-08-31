import { readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  assertSafeUpload,
  parseCadastroBuffer,
  isJunkRow,
  parseDescAbrevIcms,
  parseIvaDecimal,
  ncmFromCadastroCell,
} from "./import-cadastro";
import { normalizeNcm } from "./ncm";

const EGAPLAST_XLS = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "cadastro-egaplast-ncm-2026-08-27.xls",
);
const EGAPLAST_RELATORIO = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "cadastro-egaplast-relatorio-produtos.xlsx",
);

describe("import cadastro", () => {
  it("lê fixture XLSX e não depende da aba Classes Fiscais", async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Cadastro");
    sheet.addRow([
      "codigo",
      "descricao",
      "ncm",
      "nao contr",
      "contrib",
      "revenda",
      "construt",
      "hosp/clinica",
      "orgao pub",
      "prod.rural",
      "atacado",
      "cst compra",
      "iva",
    ]);
    sheet.addRow([
      "TINTA-ST",
      "Tinta ST interno",
      "32141010",
      "0",
      "10",
      "00",
      "0",
      "0",
      "0",
      "0",
      "10",
      "0",
      "30%",
    ]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const rows = parseCadastroBuffer(buf, ".xlsx");
    expect(rows).toHaveLength(1);
    expect(rows[0].codigo).toBe("TINTA-ST");
    expect(normalizeNcm(rows[0].ncmOriginal)).toBe("32141010");
    expect(rows[0].destinosCst?.revenda).toBe("00");
    expect(JSON.stringify(rows)).not.toMatch(/Planilha_Classes_Fiscais/i);
  });

  it("lê export Santri Relação de Classes Fiscais (cabeçalho em 4 linhas)", async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Planilha1");
    sheet.addRow(["Relação de Classes Fiscais"]);
    sheet.addRow(["", "", "", "", "", "", "", "", "", "", "Venda"]);
    sheet.addRow(["", "", "", "", "Dados fiscais do produto"]);
    sheet.addRow([
      "Código",
      "Nome do produto",
      "Código original",
      "Marca",
      "NCM",
      "%ICMS",
      "Preço de pauta",
      "Preço de pauta crédito",
      "%IPI compra",
      "%IPI venda",
      "Não contr",
      "Contrib",
      "Revenda",
      "Construt",
      "Hosp/clínica",
      "Órgão púb",
      "Prod.rural",
      "Atacado",
      "Índ.red.base venda",
      "Índ.red.base ST",
      "Índ.red.DIFAL",
      "%IVA venda",
      "%IVA venda p/ produto importado",
      "Indústria",
      "Revenda",
      "Atacado",
      "x",
      "x",
      "x",
      "x",
      "x",
      "x",
      "%IVA compra",
    ]);
    sheet.addRow([
      "205.199",
      "ADAPT SOLD CURTO LR 25MM",
      "153178",
      "PLASTUBOS",
      "39174090",
      "20,00",
      "0",
      "0",
      "0",
      "0",
      "60",
      "60",
      "60",
      "60",
      "60",
      "60",
      "60",
      "60",
      "",
      "",
      "",
      "0",
      "0",
      "60",
      "60",
      "60",
      "",
      "",
      "",
      "",
      "",
      "",
      "26,51",
    ]);
    sheet.addRow(["Filtros Selecionados"]);
    sheet.addRow(["2 - ATACADO", "2 - ATACADO", "", "", ""]);
    sheet.addRow(["Ativo...............: Sim", "Ativo...............: Sim"]);
    sheet.addRow(["Data de cadastro....: 01/01/2026 até 31/07/2026", "Data de cadastro....: 01/01/2026 até 31/07/2026"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const rows = parseCadastroBuffer(buf, ".xlsx");
    expect(rows).toHaveLength(1);
    expect(rows[0].codigo).toBe("205.199");
    expect(rows[0].ncm).toBe("39174090");
    expect(rows[0].destinosCst?.naoContribuinte).toBe("60");
    expect(rows[0].destinosCst?.revenda).toBe("60");
    expect(rows[0].cstCompra).toBe("60");
    expect(rows[0].ivaMvaNumero).toBeCloseTo(26.51);
  });

  it("ignora rodapé e cabeçalho do Santri que não são produto", () => {
    expect(isJunkRow("2 - ATACADO", "2 - ATACADO")).toBe(true);
    expect(isJunkRow("Ativo...............: Sim", "Ativo...............: Sim")).toBe(true);
    expect(
      isJunkRow(
        "Data de cadastro....: 01/01/2026 até 31/07/2026",
        "Data de cadastro....: 01/01/2026 até 31/07/2026",
      ),
    ).toBe(true);
    expect(isJunkRow("204.834", "TINTA ESM FOSCO PISO 18 L PRETO SUVINIL")).toBe(false);
  });

  it("lê CSV Unica (Cód.Item + Novo NCM + Desc. Abrev. ICMS) sem corromper CST em data", () => {
    const csv = [
      "Cód.Item;Descrição;Novo NCM / Classif. IPI;Novo Abreviação Fiscal;Desc. Abrev. ICMS;",
      "21031;1K ALL PLASTICS SPRAY SIKKENS;32089039;004;010 18 0;",
      "23140;7405S CHROMA NON-STOP ACTIVADOR;39119029;002;000 18 0;",
      "99999;LONA ESPECIAL;39269090;017;ABR FISCAL LONAS;",
      "86566;AB REPARADOR FLEXIVEL 530G;32141020;003;060 0 0;",
    ].join("\r\n");
    // Windows-1252 bytes (como o export real da Unica)
    const buffer = Buffer.from(csv, "latin1");
    const rows = parseCadastroBuffer(buffer, ".csv");
    expect(rows).toHaveLength(4);

    expect(rows[0].codigo).toBe("21031");
    expect(rows[0].descricao).toContain("SIKKENS");
    expect(rows[0].ncm).toBe("32089039");
    expect(rows[0].abreviacao).toBe("004");
    expect(rows[0].cstUnico).toBe("10");
    expect(rows[0].aliquotaIcms).toBeNull();
    expect(String(rows[0].cstUnico)).not.toMatch(/\//);

    expect(rows[1].codigo).toBe("23140");
    expect(rows[1].abreviacao).toBe("002");
    expect(rows[1].cstUnico).toBe("0");
    expect(rows[1].aliquotaIcms).toBeNull();

    expect(rows[2].codigo).toBe("99999");
    expect(rows[2].abreviacao).toBe("017");
    expect(rows[2].cstUnico).toBeNull();
    expect(rows[2].aliquotaIcms).toBeNull();

    expect(rows[3].codigo).toBe("86566");
    expect(rows[3].abreviacao).toBe("003");
    expect(rows[3].cstUnico).toBe("60");
    expect(rows[3].aliquotaIcms).toBeNull();
  });

  it("parseDescAbrevIcms extrai CST e alíquota do padrão Unica", () => {
    expect(parseDescAbrevIcms("010 18 0")).toEqual({ cstUnico: "10", aliquotaIcms: "18" });
    expect(parseDescAbrevIcms("000 18 0")).toEqual({ cstUnico: "0", aliquotaIcms: "18" });
    expect(parseDescAbrevIcms("ABR FISCAL LONAS")).toEqual({
      cstUnico: null,
      aliquotaIcms: null,
    });
  });

  it("aceita extensão .xls no upload de cadastro", () => {
    expect(assertSafeUpload("ncm.xls", 1000, "application/vnd.ms-excel")).toBe(".xls");
    expect(assertSafeUpload("ncm.xls", 1000, "application/octet-stream")).toBe(".xls");
  });

  it("NCM 0/vazio não vira 00000000", () => {
    expect(ncmFromCadastroCell("0")).toEqual({ ncm: "", ncmOriginal: "" });
    expect(ncmFromCadastroCell("")).toEqual({ ncm: "", ncmOriginal: "" });
    expect(ncmFromCadastroCell("84818019").ncm).toBe("84818019");
  });

  it("parseIvaDecimal preserva ponto decimal (não trata como milhar)", () => {
    expect(parseIvaDecimal("1.5763")).toBeCloseTo(1.5763, 4);
    expect(parseIvaDecimal("1.9551")).toBeCloseTo(1.9551, 4);
    expect(parseIvaDecimal("0")).toBe(0);
  });

  it("lê listagem Egaplast ncm.xls (aba Dados)", () => {
    const rows = parseCadastroBuffer(readFileSync(EGAPLAST_XLS), ".xls");
    expect(rows.length).toBe(4153);
    const gold = rows.find((r) => r.codigo === "10100");
    expect(gold).toBeTruthy();
    expect(gold?.ncm).toBe("84818019");
    expect(gold?.descricao).toContain("KIT P/CX ACOP");
    const semNcm = rows.filter((r) => !r.ncm);
    expect(semNcm.length).toBeGreaterThanOrEqual(20);
    expect(semNcm.every((r) => r.ncmOriginal === "")).toBe(true);
  });

  it("lê relatório Egaplast em blocos e deduplica códigos", () => {
    const rows = parseCadastroBuffer(readFileSync(EGAPLAST_RELATORIO), ".xlsx");
    expect(rows.length).toBe(1127);
    const tributado = rows.find((r) => r.codigo === "950018");
    expect(tributado?.ncm).toBe("32064990");
    expect(tributado?.cstUnico).toBe("0");
    const st = rows.find((r) => r.codigo === "30790");
    expect(st?.ncm).toBe("39172900");
    expect(st?.cstUnico).toBe("10");
    expect(st?.ivaMvaNumero).toBeTruthy();
    expect(st?.ivaMvaNumero ?? 0).toBeGreaterThan(0);
    expect(st?.ivaMvaNumero ?? 0).toBeLessThan(100);
    const semNcm = rows.find((r) => r.codigo === "990363");
    expect(semNcm?.ncm).toBe("");
    expect(semNcm?.cstUnico).toBe("0");
  });
});

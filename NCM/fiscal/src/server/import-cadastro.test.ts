import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseCadastroBuffer, isJunkRow, parseDescAbrevIcms } from "./import-cadastro";
import { normalizeNcm } from "./ncm";

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
    expect(rows[0].cstUnico).toBe("10");
    expect(rows[0].aliquotaIcms).toBe("18");
    expect(String(rows[0].cstUnico)).not.toMatch(/\//);

    expect(rows[1].codigo).toBe("23140");
    expect(rows[1].cstUnico).toBe("0");
    expect(rows[1].aliquotaIcms).toBe("18");

    expect(rows[2].codigo).toBe("99999");
    expect(rows[2].cstUnico).toBeNull();
    expect(rows[2].aliquotaIcms).toBeNull();

    expect(rows[3].codigo).toBe("86566");
    expect(rows[3].cstUnico).toBe("60");
    expect(rows[3].aliquotaIcms).toBe("0");
  });

  it("parseDescAbrevIcms extrai CST e alíquota do padrão Unica", () => {
    expect(parseDescAbrevIcms("010 18 0")).toEqual({ cstUnico: "10", aliquotaIcms: "18" });
    expect(parseDescAbrevIcms("000 18 0")).toEqual({ cstUnico: "0", aliquotaIcms: "18" });
    expect(parseDescAbrevIcms("ABR FISCAL LONAS")).toEqual({
      cstUnico: null,
      aliquotaIcms: null,
    });
  });
});

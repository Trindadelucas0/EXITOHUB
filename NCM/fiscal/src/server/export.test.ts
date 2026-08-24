import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildExcel, buildPdf, buildReport } from "./export";
import type { CompareResult, DestinosCst, FiscalRule } from "./compare";

const destinos: DestinosCst = {
  naoContribuinte: "00",
  contribuinte: "10",
  revenda: "10",
  construtora: "00",
  hospClinica: "00",
  orgaoPublico: "00",
  produtorRural: "00",
  atacado: "10",
};

const rule: FiscalRule = {
  id: "r1",
  ncm: "32141010",
  ncmOriginal: "32141010",
  segmento: "Tintas",
  cstEntrada: "00",
  cstSaida: "00",
  cfopSaida: "5102",
  destinosCst: destinos,
  situacao: "Regra geral",
  situacaoCodigo: "REGRA_GERAL",
  mvaPercentual: 40,
  mvaTexto: "40",
  mvaKind: "percent",
};

const compare: CompareResult = {
  status: "DIVERGENTE",
  motivo: '<script>alert("xss")</script>',
  diffs: [
    { campo: "Revenda", atual: "00", ideal: "10" },
    { campo: "CST BAIFER", atual: "10", ideal: "00" },
  ],
  rule,
  candidates: [],
  needsLink: false,
};

function sampleReport() {
  return buildReport({
    companyName: "BAIFER",
    batchFileName: "bs.xlsx",
    generatedAt: new Date("2026-08-19T12:00:00Z"),
    items: [
      {
        codigo: "P1",
        descricao: "<b>produto</b>",
        ncm: "32141010",
        cstCompra: "00",
        cstUnico: "10",
        ivaMva: "0",
        destinosCst: { ...destinos, revenda: "00" },
        compare,
      },
    ],
  });
}

describe("export", () => {
  it("PDF inclui grade, detalhe e escapa HTML", async () => {
    const report = sampleReport();
    expect(report.groups[0]?.products[0]?.status).toBe("DIVERGENTE");
    const pdf = await buildPdf(report);
    const text = pdf.toString("latin1").toLowerCase();
    expect(text.startsWith("%pdf")).toBe(true);
    expect(text).not.toContain("<script>");
    expect(text).not.toContain("<b>produto</b>");
    expect(text).toContain("/flatedecode");
  });

  it("Excel separa destinatários por coluna e tem quatro abas", async () => {
    const buffer = await buildExcel(sampleReport());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as never);
    expect(wb.worksheets.map((sheet) => sheet.name)).toEqual([
      "Resumo",
      "Por regra",
      "Regras",
      "Campos",
    ]);
    const porRegra = wb.getWorksheet("Por regra");
    expect(porRegra).toBeDefined();
    const rowValues = porRegra?.getRow(1).values;
    const headers = Array.isArray(rowValues) ? rowValues.map((value) => String(value ?? "")) : [];
    expect(headers.join(" ")).toContain("Não contr (imp.)");
    expect(headers.join(" ")).toContain("Não contr (regra)");
    expect(headers.join(" ")).not.toContain("Não contribuinte:00 |");
    const banner = String(porRegra?.getRow(2).getCell(1).value ?? "");
    expect(banner).toContain("NCM 32141010");
    expect(banner).toContain("CST BAIFER");
    const campos = wb.getWorksheet("Campos");
    expect(String(campos?.getRow(1).getCell(6).value)).toBe("Como deve ficar");
  });
});

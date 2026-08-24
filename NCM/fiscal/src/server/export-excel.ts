import "server-only";

import ExcelJS from "exceljs";
import { DESTINO_KEYS, DESTINO_SHORT_LABELS, labelCampoFiscal } from "@/src/lib/fiscal";
import {
  EXPORT_COLORS as C,
  allProducts,
  cellMismatch,
  formatExportDate,
  ruleBannerText,
  rulesOfReport,
  showCst,
  type ExportProduct,
  type ExportReport,
} from "./export-model";

type Sheet = ExcelJS.Worksheet;

function fill(argb: string): ExcelJS.FillPattern {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function argb(hex: string): string {
  return `FF${hex}`;
}

function font(opts: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> {
  return { name: "Calibri", size: 10, color: { argb: argb(C.ink) }, ...opts };
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const edge: ExcelJS.Border = { style: "thin", color: { argb: argb(C.line) } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function statusFill(status: ExportProduct["status"]): string {
  if (status === "DIVERGENTE") return C.badBg;
  if (status === "NECESSITA_ANALISE") return C.warnBg;
  return C.okBg;
}

function statusColor(status: ExportProduct["status"]): string {
  if (status === "DIVERGENTE") return C.bad;
  if (status === "NECESSITA_ANALISE") return C.warn;
  return C.ok;
}

function pairHeaders(): { header: string; width: number; key: string }[] {
  const destinos = DESTINO_KEYS.flatMap((key) => [
    { header: `${DESTINO_SHORT_LABELS[key]} (imp.)`, width: 12, key: `${key}_imp` },
    { header: `${DESTINO_SHORT_LABELS[key]} (regra)`, width: 12, key: `${key}_regra` },
  ]);
  return [
    { header: "Código", width: 14, key: "codigo" },
    { header: "Descrição", width: 42, key: "descricao" },
    { header: "NCM", width: 12, key: "ncm" },
    { header: "Status", width: 18, key: "status" },
    { header: "Situação", width: 14, key: "situacao" },
    { header: "Motivo", width: 48, key: "motivo" },
    { header: "CST entrada (imp.)", width: 16, key: "cstE_imp" },
    { header: "CST entrada (regra)", width: 16, key: "cstE_regra" },
    { header: "CST saída (imp.)", width: 14, key: "cstS_imp" },
    { header: "CST saída (regra)", width: 16, key: "cstS_regra" },
    { header: "CFOP", width: 10, key: "cfop" },
    { header: "MVA (imp.)", width: 12, key: "mva_imp" },
    { header: "MVA (regra)", width: 12, key: "mva_regra" },
    ...destinos,
  ];
}

function styleHeader(row: ExcelJS.Row, count: number) {
  row.height = 28;
  row.font = font({ bold: true, size: 9, color: { argb: argb(C.muted) } });
  for (let i = 1; i <= count; i += 1) {
    const cell = row.getCell(i);
    cell.fill = fill(argb(C.paper));
    cell.border = thinBorder();
    cell.alignment = { vertical: "middle", wrapText: true };
  }
}

function paint(cell: ExcelJS.Cell, value: string, mismatch: boolean, side: "atual" | "ideal") {
  cell.value = value;
  cell.font = font({
    size: 9,
    color: { argb: argb(mismatch ? (side === "atual" ? C.bad : C.ok) : C.ink) },
  });
  cell.alignment = { vertical: "middle", horizontal: "center" };
  cell.border = thinBorder();
  if (mismatch) {
    cell.fill = fill(argb(side === "atual" ? C.badBg : C.okBg));
  }
}

function writeProductRow(sheet: Sheet, product: ExportProduct, outlineLevel: number) {
  const values: (string | number)[] = [
    product.codigo,
    product.descricao,
    product.ncm,
    product.status,
    product.situacao || "—",
    product.motivo,
    showCst(product.cstEntradaAtual),
    showCst(product.cstEntradaIdeal),
    showCst(product.cstSaidaAtual),
    showCst(product.cstSaidaIdeal),
    showCst(product.cfopSaida),
    showCst(product.mvaAtual),
    showCst(product.mvaIdeal),
  ];
  for (const key of DESTINO_KEYS) {
    values.push(showCst(product.destinosAtual?.[key]));
    values.push(showCst(product.destinosIdeal?.[key]));
  }
  const row = sheet.addRow(values);
  row.outlineLevel = outlineLevel;
  row.alignment = { vertical: "middle" };
  row.font = font({ size: 9 });
  const last = values.length;
  for (let i = 1; i <= last; i += 1) {
    row.getCell(i).border = thinBorder();
  }
  row.getCell(4).fill = fill(argb(statusFill(product.status)));
  row.getCell(4).font = font({ size: 9, bold: true, color: { argb: argb(statusColor(product.status)) } });

  const pairs: [number, number, boolean][] = [
    [7, 8, cellMismatch(product.cstEntradaAtual, product.cstEntradaIdeal)],
    [9, 10, cellMismatch(product.cstSaidaAtual, product.cstSaidaIdeal)],
    [12, 13, cellMismatch(product.mvaAtual, product.mvaIdeal)],
  ];
  DESTINO_KEYS.forEach((key, index) => {
    const atualCol = 14 + index * 2;
    const idealCol = atualCol + 1;
    pairs.push([
      atualCol,
      idealCol,
      cellMismatch(product.destinosAtual?.[key], product.destinosIdeal?.[key]),
    ]);
  });
  for (const [atualCol, idealCol, mismatch] of pairs) {
    paint(row.getCell(atualCol), String(row.getCell(atualCol).value ?? ""), mismatch, "atual");
    paint(row.getCell(idealCol), String(row.getCell(idealCol).value ?? ""), mismatch, "ideal");
  }
}

function writeResumo(wb: ExcelJS.Workbook, report: ExportReport) {
  const sheet = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  sheet.columns = [{ width: 28 }, { width: 48 }, { width: 22 }];
  sheet.mergeCells("A1:C1");
  sheet.getCell("A1").value = "Auditor Fiscal";
  sheet.getCell("A1").font = font({ bold: true, size: 18, color: { argb: argb(C.brand) } });
  sheet.mergeCells("A2:C2");
  sheet.getCell("A2").value = report.meta.title;
  sheet.getCell("A2").font = font({ size: 12, color: { argb: argb(C.muted) } });

  const rows: [string, string][] = [
    ["Empresa", report.meta.companyName],
    ["Lote", report.meta.batchFileName],
    ["Gerado em", formatExportDate(report.meta.generatedAt)],
    ["Produtos neste arquivo", String(report.meta.total)],
    ["Divergentes", String(report.meta.divergentes)],
    ["Necessita análise", String(report.meta.analise)],
  ];
  let r = 4;
  for (const [label, value] of rows) {
    sheet.getCell(`A${r}`).value = label;
    sheet.getCell(`A${r}`).font = font({ size: 10, color: { argb: argb(C.muted) } });
    sheet.getCell(`B${r}`).value = value;
    sheet.getCell(`B${r}`).font = font({ size: 11, bold: true });
    r += 1;
  }
  r += 1;
  sheet.getCell(`A${r}`).value = "Legenda";
  sheet.getCell(`A${r}`).font = font({ bold: true, size: 11, color: { argb: argb(C.brand) } });
  r += 1;
  sheet.getCell(`A${r}`).value = "Importado errado";
  sheet.getCell(`A${r}`).fill = fill(argb(C.badBg));
  sheet.getCell(`A${r}`).font = font({ color: { argb: argb(C.bad) } });
  sheet.getCell(`B${r}`).value = "Como deve ficar (regra)";
  sheet.getCell(`B${r}`).fill = fill(argb(C.okBg));
  sheet.getCell(`B${r}`).font = font({ color: { argb: argb(C.ok) } });
  r += 2;
  sheet.getCell(`A${r}`).value =
    "A aba Por regra mostra cada NCM com a regra inteira e, abaixo, os produtos. Use o agrupamento à esquerda para recolher.";
  sheet.mergeCells(`A${r}:C${r + 1}`);
  sheet.getCell(`A${r}`).alignment = { wrapText: true, vertical: "top" };
  sheet.getCell(`A${r}`).font = font({ size: 10, color: { argb: argb(C.muted) } });
}

function writePorRegra(wb: ExcelJS.Workbook, report: ExportReport) {
  const headers = pairHeaders();
  const sheet = wb.addWorksheet("Por regra", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 1 }],
  });
  sheet.properties.outlineLevelRow = 1;
  sheet.properties.outlineProperties = { summaryBelow: false, summaryRight: false };
  sheet.columns = headers.map((col) => ({ width: col.width }));
  const headerRow = sheet.addRow(headers.map((col) => col.header));
  styleHeader(headerRow, headers.length);

  for (const group of report.groups) {
    const banner = sheet.addRow([ruleBannerText(group.rule, group.ncm)]);
    banner.outlineLevel = 0;
    banner.font = font({ bold: true, size: 9, color: { argb: argb(C.paper) } });
    banner.height = 22;
    sheet.mergeCells(banner.number, 1, banner.number, headers.length);
    const bannerCell = banner.getCell(1);
    bannerCell.fill = fill(argb(C.brand));
    bannerCell.alignment = { vertical: "middle", wrapText: false };
    for (let i = 1; i <= headers.length; i += 1) {
      banner.getCell(i).fill = fill(argb(C.brand));
      banner.getCell(i).border = thinBorder();
    }
    for (const product of group.products) {
      writeProductRow(sheet, product, 1);
    }
  }
}

function writeRegras(wb: ExcelJS.Workbook, report: ExportReport) {
  const sheet = wb.addWorksheet("Regras", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const headers = [
    "NCM",
    "Segmento",
    "CST entrada",
    "CST BAIFER",
    "CFOP",
    ...DESTINO_KEYS.map((key) => DESTINO_SHORT_LABELS[key]),
    "Situação",
    "MVA",
  ];
  sheet.columns = [
    { width: 12 },
    { width: 36 },
    { width: 14 },
    { width: 14 },
    { width: 10 },
    ...DESTINO_KEYS.map(() => ({ width: 12 })),
    { width: 16 },
    { width: 12 },
  ];
  const headerRow = sheet.addRow(headers);
  styleHeader(headerRow, headers.length);
  for (const rule of rulesOfReport(report)) {
    const row = sheet.addRow([
      rule.ncm,
      rule.segmento,
      showCst(rule.cstEntrada),
      showCst(rule.cstSaida),
      showCst(rule.cfopSaida),
      ...DESTINO_KEYS.map((key) => showCst(rule.destinosCst[key])),
      rule.situacaoCodigo || rule.situacao,
      showCst(rule.mvaTexto),
    ]);
    row.font = font({ size: 9 });
    for (let i = 1; i <= headers.length; i += 1) {
      row.getCell(i).border = thinBorder();
      row.getCell(i).alignment = { vertical: "middle" };
    }
  }
  if (rulesOfReport(report).length) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: sheet.rowCount, column: headers.length },
    };
  }
}

function writeCampos(wb: ExcelJS.Workbook, report: ExportReport) {
  const sheet = wb.addWorksheet("Campos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const headers = ["Código", "NCM", "Status", "Campo", "Importado", "Como deve ficar"];
  sheet.columns = [
    { width: 14 },
    { width: 12 },
    { width: 18 },
    { width: 32 },
    { width: 36 },
    { width: 36 },
  ];
  const headerRow = sheet.addRow(headers);
  styleHeader(headerRow, headers.length);
  for (const product of allProducts(report)) {
    const diffs = product.diffs.length
      ? product.diffs
      : [{ campo: "Observação", atual: product.motivo, ideal: product.situacao || "—" }];
    for (const diff of diffs) {
      const row = sheet.addRow([
        product.codigo,
        product.ncm,
        product.status,
        labelCampoFiscal(diff.campo),
        diff.atual,
        diff.ideal,
      ]);
      row.font = font({ size: 9 });
      for (let i = 1; i <= headers.length; i += 1) {
        row.getCell(i).border = thinBorder();
        row.getCell(i).alignment = { vertical: "middle", wrapText: true };
      }
      row.getCell(5).fill = fill(argb(C.badBg));
      row.getCell(5).font = font({ size: 9, color: { argb: argb(C.bad) } });
      row.getCell(6).fill = fill(argb(C.okBg));
      row.getCell(6).font = font({ size: 9, color: { argb: argb(C.ok) } });
    }
  }
  if (sheet.rowCount > 1) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: sheet.rowCount, column: headers.length },
    };
  }
}

export async function buildExcel(report: ExportReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Auditor Fiscal";
  wb.created = report.meta.generatedAt;
  writeResumo(wb, report);
  writePorRegra(wb, report);
  writeRegras(wb, report);
  writeCampos(wb, report);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

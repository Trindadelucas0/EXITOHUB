import "server-only";

import PDFDocument from "pdfkit";
import { escapeHtml } from "@/src/lib/html";
import { DESTINO_KEYS, DESTINO_SHORT_LABELS, labelCampoFiscal } from "@/src/lib/fiscal";
import {
  EXPORT_COLORS as C,
  allProducts,
  cellMismatch,
  formatExportDate,
  showCst,
  type ExportMeta,
  type ExportProduct,
  type ExportReport,
} from "./export-model";

type PdfDoc = InstanceType<typeof PDFDocument>;

type Cell = {
  text: string;
  width: number;
  fill?: string;
  color?: string;
  align?: "left" | "center";
};

const MARGIN = 28;
const HEADER_H = 32;
const FOOTER_H = 22;
const ROW_H = 16;
const TABLE_HEADER_H = 28;

function hex(color: string): string {
  return `#${color}`;
}

function safe(value: string | null | undefined): string {
  return escapeHtml(value ?? "");
}

function gridColumns(): { id: string; header: string; width: number }[] {
  const dest = DESTINO_KEYS.map((key) => ({
    id: key,
    header: DESTINO_SHORT_LABELS[key],
    width: 34,
  }));
  return [
    { id: "codigo", header: "Código", width: 52 },
    { id: "descricao", header: "Descrição", width: 138 },
    { id: "ncm", header: "NCM", width: 50 },
    { id: "status", header: "Status", width: 58 },
    { id: "situacao", header: "Situação", width: 50 },
    { id: "cstEntrada", header: "CST ent.", width: 36 },
    { id: "cstSaida", header: "CST saída", width: 40 },
    { id: "cfop", header: "CFOP", width: 32 },
    { id: "mva", header: "MVA", width: 32 },
    ...dest,
  ];
}

function productCells(product: ExportProduct): Cell[] {
  const mismatchFill = (atual: string | null | undefined, ideal: string | null | undefined): Partial<Cell> =>
    cellMismatch(atual, ideal) ? { fill: C.badBg, color: C.bad } : {};

  const destinos = DESTINO_KEYS.map((key) => {
    const atual = product.destinosAtual?.[key] ?? null;
    const ideal = product.destinosIdeal?.[key] ?? null;
    return {
      text: safe(showCst(atual)),
      width: 34,
      align: "center" as const,
      ...mismatchFill(atual, ideal),
    };
  });

  return [
    { text: safe(product.codigo), width: 52 },
    { text: safe(product.descricao), width: 138 },
    { text: safe(product.ncm || "(vazio)"), width: 50 },
    {
      text: safe(product.status),
      width: 58,
      fill: product.status === "DIVERGENTE" ? C.badBg : product.status === "NECESSITA_ANALISE" ? C.warnBg : C.okBg,
      color: product.status === "DIVERGENTE" ? C.bad : product.status === "NECESSITA_ANALISE" ? C.warn : C.ok,
    },
    { text: safe(product.situacao || "—"), width: 50 },
    {
      text: safe(showCst(product.cstEntradaAtual)),
      width: 36,
      align: "center",
      ...mismatchFill(product.cstEntradaAtual, product.cstEntradaIdeal),
    },
    {
      text: safe(showCst(product.cstSaidaAtual)),
      width: 40,
      align: "center",
      ...mismatchFill(product.cstSaidaAtual, product.cstSaidaIdeal),
    },
    { text: safe(showCst(product.cfopSaida)), width: 32, align: "center" },
    {
      text: safe(showCst(product.mvaAtual)),
      width: 32,
      align: "center",
      ...mismatchFill(product.mvaAtual, product.mvaIdeal),
    },
    ...destinos,
  ];
}

function pinCursor(doc: PdfDoc, y = contentTop()) {
  doc.x = MARGIN;
  doc.y = y;
}

function drawChrome(doc: PdfDoc, meta: ExportMeta, page: number) {
  const w = doc.page.width;
  const h = doc.page.height;
  doc.save();
  doc.rect(0, 0, w, HEADER_H).fill(hex(C.brand));
  doc.rect(0, h - FOOTER_H, w, FOOTER_H).fill(hex(C.paper));
  doc.restore();
  doc.fillColor(hex(C.paper)).font("Helvetica-Bold").fontSize(10);
  doc.text("Auditor Fiscal", MARGIN, 11, { lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(hex(C.paper));
  doc.text(safe(meta.companyName), MARGIN + 92, 12, { lineBreak: false });
  doc.text(safe(meta.title), w - 280, 12, { width: 252, align: "right", lineBreak: false });
  doc.fillColor(hex(C.muted)).fontSize(7);
  doc.text(
    `${safe(meta.batchFileName)}  ·  ${formatExportDate(meta.generatedAt)}  ·  uso interno`,
    MARGIN,
    h - 14,
    { lineBreak: false },
  );
  doc.text(`Página ${page}`, w - 100, h - 14, { width: 72, align: "right", lineBreak: false });
  pinCursor(doc);
}

function contentTop(): number {
  return HEADER_H + 12;
}

function contentBottom(doc: PdfDoc): number {
  return doc.page.height - FOOTER_H - 8;
}

function drawRow(doc: PdfDoc, x: number, y: number, height: number, cells: Cell[], header = false) {
  let cursor = x;
  for (const cell of cells) {
    const fill = cell.fill ?? (header ? C.paper : C.white);
    doc.save();
    doc.rect(cursor, y, cell.width, height).fill(hex(fill));
    doc.rect(cursor, y, cell.width, height).strokeColor(hex(C.line)).lineWidth(0.4).stroke();
    doc.fillColor(hex(cell.color ?? (header ? C.muted : C.ink)));
    doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(header ? 6.5 : 7);
    const textY = y + (height - 8) / 2;
    doc.text(cell.text, cursor + 3, textY, {
      width: cell.width - 6,
      height: height - 4,
      align: cell.align ?? "left",
      ellipsis: true,
      lineBreak: false,
    });
    doc.restore();
    cursor += cell.width;
  }
  pinCursor(doc, y + height);
}

export async function buildPdf(report: ExportReport): Promise<Buffer> {
  const doc = new PDFDocument({
    margin: MARGIN,
    size: "A4",
    layout: "landscape",
    compress: true,
    bufferPages: true,
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const meta = report.meta;
  const cols = gridColumns();
  const tableWidth = cols.reduce((sum, col) => sum + col.width, 0);
  const products = allProducts(report);
  let page = 1;

  drawChrome(doc, meta, page);
  pinCursor(doc);
  let y = contentTop();

  doc.fillColor(hex(C.ink)).font("Helvetica-Bold").fontSize(16);
  doc.text(safe(meta.title), MARGIN, y);
  y += 22;
  doc.font("Helvetica").fontSize(9).fillColor(hex(C.muted));
  doc.text(
    `${safe(meta.companyName)}  ·  lote ${safe(meta.batchFileName)}  ·  gerado em ${formatExportDate(meta.generatedAt)}`,
    MARGIN,
    y,
    { width: tableWidth },
  );
  y += 16;

  const cards = [
    { label: "No arquivo", value: String(meta.total) },
    { label: "Divergentes", value: String(meta.divergentes) },
    { label: "Necessita análise", value: String(meta.analise) },
  ];
  let cardX = MARGIN;
  for (const card of cards) {
    doc.save();
    doc.roundedRect(cardX, y, 150, 36, 4).fill(hex(C.paper));
    doc.fillColor(hex(C.muted)).font("Helvetica").fontSize(7).text(card.label, cardX + 10, y + 7, { lineBreak: false });
    doc.fillColor(hex(C.brand)).font("Helvetica-Bold").fontSize(12).text(card.value, cardX + 10, y + 18, { lineBreak: false });
    doc.restore();
    cardX += 162;
  }
  pinCursor(doc, y);
  y += 50;

  const ensureSpace = (needed: number, redrawHeader: boolean) => {
    if (y + needed <= contentBottom(doc)) return;
    doc.addPage();
    page += 1;
    drawChrome(doc, meta, page);
    pinCursor(doc);
    y = contentTop();
    if (redrawHeader) {
      drawRow(
        doc,
        MARGIN,
        y,
        TABLE_HEADER_H,
        cols.map((col) => ({ text: col.header, width: col.width, align: col.id === "descricao" || col.id === "codigo" ? "left" : "center" })),
        true,
      );
      y += TABLE_HEADER_H;
    }
  };

  doc.fillColor(hex(C.brand)).font("Helvetica-Bold").fontSize(11);
  doc.text("Grade do cadastro", MARGIN, y);
  y += 16;
  doc.font("Helvetica").fontSize(8).fillColor(hex(C.muted));
  doc.text("Mesmas colunas da tela. Célula vermelha = valor importado diferente da regra. O correto está no detalhe.", MARGIN, y, {
    width: tableWidth,
  });
  y += 16;

  ensureSpace(TABLE_HEADER_H + ROW_H, false);
  drawRow(
    doc,
    MARGIN,
    y,
    TABLE_HEADER_H,
    cols.map((col) => ({
      text: col.header,
      width: col.width,
      align: col.id === "descricao" || col.id === "codigo" ? "left" : "center",
    })),
    true,
  );
  y += TABLE_HEADER_H;

  for (const product of products) {
    ensureSpace(ROW_H, true);
    drawRow(doc, MARGIN, y, ROW_H, productCells(product));
    y += ROW_H;
  }

  y += 18;
  ensureSpace(40, false);
  doc.fillColor(hex(C.brand)).font("Helvetica-Bold").fontSize(11);
  doc.text("Detalhamento", MARGIN, y);
  y += 14;
  doc.font("Helvetica").fontSize(8).fillColor(hex(C.muted));
  doc.text("Campo a campo: o que veio no cadastro e como deve ficar segundo a regra.", MARGIN, y, { width: tableWidth });
  y += 16;

  const detailWidths = [170, 280, 280];
  for (const product of products) {
    const diffs = product.diffs;
    const blockH = 36 + Math.max(1, diffs.length) * 16 + 10;
    ensureSpace(Math.min(blockH, 80), false);

    doc.save();
    doc.rect(MARGIN, y, tableWidth, 22).fill(hex(C.paper));
    doc.fillColor(hex(C.ink)).font("Helvetica-Bold").fontSize(8);
    doc.text(`${safe(product.codigo)}  ·  NCM ${safe(product.ncm || "(vazio)")}  ·  ${safe(product.status)}`, MARGIN + 6, y + 7, {
      width: tableWidth - 12,
      lineBreak: false,
    });
    doc.restore();
    y += 24;
    pinCursor(doc, y);
    doc.font("Helvetica").fontSize(8).fillColor(hex(C.ink));
    const descH = doc.heightOfString(safe(product.descricao), { width: tableWidth });
    ensureSpace(descH + 8, false);
    doc.text(safe(product.descricao), MARGIN, y, { width: tableWidth });
    y += descH + 4;
    const motivoH = doc.heightOfString(safe(product.motivo), { width: tableWidth });
    ensureSpace(motivoH + 8, false);
    doc.fillColor(hex(C.muted)).fontSize(8);
    doc.text(safe(product.motivo), MARGIN, y, { width: tableWidth });
    y += motivoH + 8;

    const headers: Cell[] = [
      { text: "Campo", width: detailWidths[0] },
      { text: "Importado (errado)", width: detailWidths[1] },
      { text: "Como deve ficar", width: detailWidths[2] },
    ];
    ensureSpace(ROW_H * 2, false);
    drawRow(doc, MARGIN, y, ROW_H, headers, true);
    y += ROW_H;

    const rows = diffs.length
      ? diffs
      : [{ campo: "Observação", atual: product.motivo, ideal: product.situacao || "—" }];
    for (const diff of rows) {
      ensureSpace(ROW_H, false);
      drawRow(doc, MARGIN, y, ROW_H, [
        { text: safe(labelCampoFiscal(diff.campo)), width: detailWidths[0] },
        { text: safe(diff.atual), width: detailWidths[1], fill: C.badBg, color: C.bad },
        { text: safe(diff.ideal), width: detailWidths[2], fill: C.okBg, color: C.ok },
      ]);
      y += ROW_H;
    }
    y += 12;
  }

  doc.end();
  return done;
}

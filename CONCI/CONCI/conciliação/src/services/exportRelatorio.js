'use strict';

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { formatDateBr } = require('./utils');
const { formatCompetencia } = require('./conciliacaoStore');

const LOGO_PATH = path.join(__dirname, '..', '..', 'assets', 'logo.png');
const BRAND_GREEN = '39B54A';
const BRAND_GREEN_HEX = '#39B54A';

/**
 * Relatório detalhado de conciliação (Excel/PDF) — mesmas colunas da tela de
 * Revisão (Data, Débito, Crédito, Valor, Histórico, Nº Nota, Classificação Êxito),
 * com Banco e Competência sempre visíveis no cabeçalho do arquivo, mais duas
 * colunas em branco para o cliente preencher: Verificação do cliente (OK/PENDENTE)
 * e Observação (última coluna).
 */

const COLUMNS = [
  { key: 'data', label: 'Data' },
  { key: 'debito', label: 'Débito' },
  { key: 'credito', label: 'Crédito' },
  { key: 'valor', label: 'Valor' },
  { key: 'historico', label: 'Histórico' },
  { key: 'numeroNota', label: 'Nº Nota' },
  { key: 'classificacaoCap', label: 'Classificação Êxito' },
  { key: 'verificacaoCliente', label: 'Verificação do cliente' },
  { key: 'observacao', label: 'Observação' },
];

function formatMoneyBr(v) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function nowLabelBr() {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function historicoComMotivo(item) {
  const hist = String(item.historico || '').trim();
  const motivo = String(item.motivo || '').trim();
  return motivo ? `${hist}\n${motivo}` : hist;
}

function cellValue(item, key) {
  switch (key) {
    case 'data':
      return formatDateBr(item.data);
    case 'debito':
      return item.debito ?? '';
    case 'credito':
      return item.credito ?? '';
    case 'valor':
      return formatMoneyBr(item.valor);
    case 'historico':
      return historicoComMotivo(item);
    case 'numeroNota':
      return item.numeroNota || '';
    case 'classificacaoCap':
      return String(item.classificacaoCap || item.categoria || '').trim();
    case 'verificacaoCliente':
    case 'observacao':
      return '';
    default:
      return '';
  }
}

function bancoLabel(session) {
  return session.bancoNome ? String(session.bancoNome).trim() : 'Não informado';
}

function competenciaLabel(session) {
  const formatted = formatCompetencia(session.competencia);
  return formatted && formatted !== session.competencia ? formatted : (session.competencia || 'Não informada');
}

/**
 * Gera buffer xlsx do relatório detalhado (Banco/Competência + todos os lançamentos).
 * @param {object} session
 * @param {Array} itens
 * @returns {Promise<Buffer>}
 */
async function exportRelatorioExcel(session, itens) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Conciliação');
  const colCount = COLUMNS.length;

  sheet.columns = [
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
    { width: 48 },
    { width: 14 },
    { width: 28 },
    { width: 18 },
    { width: 30 },
  ];

  // Coluna A, linhas 1-4: reservada para a logo (sempre em fundo branco).
  sheet.mergeCells(1, 1, 4, 1);
  for (let r = 1; r <= 4; r += 1) sheet.getRow(r).height = 20;
  if (fs.existsSync(LOGO_PATH)) {
    const logoImageId = workbook.addImage({ filename: LOGO_PATH, extension: 'png' });
    sheet.addImage(logoImageId, {
      tl: { col: 0.15, row: 0.15 },
      ext: { width: 70, height: 54 },
    });
  }

  sheet.mergeCells(1, 2, 1, colCount);
  sheet.getCell(1, 2).value = 'Relatório de Conciliação Bancária';
  sheet.getCell(1, 2).font = { bold: true, size: 14, color: { argb: 'FF0A0A0A' } };

  sheet.mergeCells(2, 2, 2, colCount);
  sheet.getCell(2, 2).value = `Banco: ${bancoLabel(session)}`;
  sheet.getCell(2, 2).font = { bold: true, size: 11 };

  sheet.mergeCells(3, 2, 3, colCount);
  sheet.getCell(3, 2).value = `Competência: ${competenciaLabel(session)}`;
  sheet.getCell(3, 2).font = { bold: true, size: 11 };

  sheet.mergeCells(4, 2, 4, colCount);
  sheet.getCell(4, 2).value = `Gerado em: ${nowLabelBr()} · Lançamentos: ${itens.length}`;
  sheet.getCell(4, 2).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

  const headerRow = sheet.getRow(5);
  headerRow.values = COLUMNS.map((c) => c.label);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND_GREEN}` } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF2E9A3C' } } };
  });

  itens.forEach((item) => {
    const row = sheet.addRow(COLUMNS.map((c) => cellValue(item, c.key)));
    row.alignment = { vertical: 'top' };
    row.getCell(4).font = {
      color: { argb: Number(item.valor) < 0 ? 'FFB91C1C' : 'FF047857' },
    };
    row.getCell(5).alignment = { vertical: 'top', wrapText: true };
    row.getCell(7).value = cellValue(item, 'classificacaoCap');
    row.getCell(8).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"OK,PENDENTE"'],
    };
    row.getCell(9).alignment = { vertical: 'top', wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Gera buffer PDF do relatório detalhado (Banco/Competência + todos os lançamentos),
 * paisagem A4, com quebra de página repetindo o cabeçalho da tabela.
 * @param {object} session
 * @param {Array} itens
 * @returns {Promise<Buffer>}
 */
function exportRelatorioPdf(session, itens) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pdfColumns = [
      { key: 'data', label: 'Data', width: 50 },
      { key: 'debito', label: 'Débito', width: 40 },
      { key: 'credito', label: 'Crédito', width: 40 },
      { key: 'valor', label: 'Valor', width: 60 },
      { key: 'historico', label: 'Histórico', width: 235 },
      { key: 'numeroNota', label: 'Nº Nota', width: 50 },
      { key: 'classificacaoCap', label: 'Classificação Êxito', width: 115 },
      { key: 'verificacaoCliente', label: 'Verificação do cliente', width: 70 },
      { key: 'observacao', label: 'Observação', width: 90 },
    ];
    const tableLeft = doc.page.margins.left;
    const tableWidth = pdfColumns.reduce((s, c) => s + c.width, 0);
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    function drawDocHeader() {
      const startY = doc.y;
      const logoWidth = 60;
      const logoHeight = 46;
      let textX = tableLeft;
      if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, tableLeft, startY, { width: logoWidth, height: logoHeight });
        textX = tableLeft + logoWidth + 14;
      }

      doc.font('Helvetica-Bold').fontSize(15).fillColor('#0a0a0a')
        .text('Relatório de Conciliação Bancária', textX, startY, { width: tableWidth - (textX - tableLeft) });
      doc.font('Helvetica-Bold').fontSize(10)
        .text(`Banco: ${bancoLabel(session)}`, textX, doc.y + 4);
      doc.font('Helvetica-Bold').fontSize(10)
        .text(`Competência: ${competenciaLabel(session)}`, textX);
      doc.font('Helvetica').fontSize(8).fillColor('#64748b')
        .text(`Gerado em: ${nowLabelBr()} · Lançamentos: ${itens.length}`, textX);
      doc.fillColor('#000000');

      doc.y = Math.max(doc.y, startY + logoHeight) + 10;
    }

    function drawTableHeader() {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(8);
      const heights = pdfColumns.map((col) => doc.heightOfString(col.label, { width: col.width - 8 }));
      const headerHeight = Math.max(...heights) + 8;
      let x = tableLeft;
      pdfColumns.forEach((col) => {
        doc.rect(x, y, col.width, headerHeight).fill(BRAND_GREEN_HEX);
        doc.fillColor('#ffffff').text(col.label, x + 4, y + 4, { width: col.width - 8 });
        x += col.width;
      });
      doc.fillColor('#000000');
      doc.y = y + headerHeight;
    }

    function ensureSpace(rowHeight) {
      if (doc.y + rowHeight > bottomLimit) {
        doc.addPage();
        doc.y = doc.page.margins.top;
        drawTableHeader();
      }
    }

    drawDocHeader();
    drawTableHeader();
    doc.font('Helvetica').fontSize(8);

    itens.forEach((item, idx) => {
      const texts = pdfColumns.map((col) => String(cellValue(item, col.key) ?? ''));
      const heights = pdfColumns.map((col, i) => doc.heightOfString(texts[i] || ' ', { width: col.width - 8 }));
      const rowHeight = Math.max(...heights) + 8;

      ensureSpace(rowHeight);

      const y = doc.y;
      if (idx % 2 === 1) {
        doc.rect(tableLeft, y, tableWidth, rowHeight).fill('#f8fafc');
      }

      let x = tableLeft;
      pdfColumns.forEach((col, i) => {
        let color = '#0f172a';
        if (col.key === 'valor') {
          color = Number(item.valor) < 0 ? '#b91c1c' : '#047857';
        }
        doc.fillColor(color).text(texts[i], x + 4, y + 4, { width: col.width - 8 });
        x += col.width;
      });
      doc.fillColor('#000000');

      x = tableLeft;
      pdfColumns.forEach((col) => {
        doc.rect(x, y, col.width, rowHeight).stroke('#e2e8f0');
        x += col.width;
      });

      doc.y = y + rowHeight;
    });

    doc.end();
  });
}

module.exports = {
  exportRelatorioExcel,
  exportRelatorioPdf,
  bancoLabel,
  competenciaLabel,
};

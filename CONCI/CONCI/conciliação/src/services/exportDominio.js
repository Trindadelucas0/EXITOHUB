'use strict';

const path = require('path');
const ExcelJS = require('exceljs');
const { formatDateBr } = require('./utils');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'templates',
  'PLANILHA PADRAO DOMINIO.xlsx',
);

function historicoComNota(item) {
  const hist = String(item.historico || '').trim();
  const nota = String(item.numeroNota || '').trim();
  if (!nota) return hist;
  return `${hist} | NF ${nota}`;
}

function valorTxt(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '';
  return Math.abs(n).toFixed(2).replace('.', ',');
}

function codigoTxt(codigo) {
  if (codigo === null || codigo === undefined || codigo === '') return '';
  return String(codigo);
}

/**
 * Gera buffer txt (Windows-1252, CRLF) no layout padrao Dominio:
 * Data;Debito;Credito;Valor;;Historico (sem cabecalho).
 * @param {Array} itens
 */
function exportDominioTxt(itens) {
  const linhas = itens.map((item) => [
    formatDateBr(item.data),
    codigoTxt(item.debito),
    codigoTxt(item.credito),
    valorTxt(item.valor),
    '',
    historicoComNota(item),
  ].join(';'));

  const conteudo = linhas.length ? `${linhas.join('\r\n')}\r\n` : '';
  return Buffer.from(conteudo, 'latin1');
}

/**
 * Gera buffer xlsx no layout da planilha padrao Dominio.
 * @param {Array} itensAprovados
 */
async function exportDominio(itensAprovados) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(TEMPLATE_PATH);
  } catch {
    // fallback: cria estrutura minima
    const ws = workbook.addWorksheet('Planilha1');
    ws.addRow(['Data', 'Débito', 'Crédito', 'Valor', null, 'Histórico']);
  }

  const sheet = workbook.worksheets[0];
  // Limpa linhas de dados (mantem cabecalho na linha 1)
  const rowCount = sheet.rowCount;
  for (let r = rowCount; r >= 2; r -= 1) {
    sheet.spliceRows(r, 1);
  }

  // Garante cabecalho
  const header = sheet.getRow(1);
  if (!header.getCell(1).value) {
    sheet.getRow(1).values = ['Data', 'Débito', 'Crédito', 'Valor', null, 'Histórico'];
  }

  for (const item of itensAprovados) {
    sheet.addRow([
      formatDateBr(item.data),
      item.debito ?? null,
      item.credito ?? null,
      item.valor,
      null,
      historicoComNota(item),
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  exportDominio,
  exportDominioTxt,
  historicoComNota,
  TEMPLATE_PATH,
};

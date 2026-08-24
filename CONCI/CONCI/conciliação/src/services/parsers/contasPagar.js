'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');
const { money, parseDate, digits, normalizeNota } = require('../utils');
const { readWorkbook, sheetToMatrix } = require('./xlsxHelper');
const {
  normalizeHeader,
  findColumnIndex,
  findBestHeaderRow,
  cellAt,
} = require('./headerMap');
const {
  MSG_SEM_CONTAS,
  isValidCategoria,
  isTotalRow,
  detectGroupLabel,
  validateConta,
  assertHasContas,
} = require('./contasPagarValidate');

const NOME_SYNONYMS = [
  'nome do cliente/fornecedor',
  'nome do cliente',
  'nome do fornecedor',
  'razao social',
  'nome fornecedor',
];
const CODIGO_FORN_SYNONYMS = ['cliente/fornecedor', 'cod fornecedor', 'codigo fornecedor'];
const CNPJ_SYNONYMS = ['cpf/cnpj', 'cpf cnpj', 'cnpj', 'cpf'];
const DOC_SYNONYMS = ['documento', 'doc'];
const NOTA_SYNONYMS = ['nr nota', 'nr. nota', 'nº nota', 'num nota', 'numero nota', 'nota'];
const VENC_SYNONYMS = ['data venc', 'data vencimento', 'vencimento', 'dt venc'];
const PAGTO_SYNONYMS = ['data pagto', 'data pagamento', 'pagamento', 'dt pagto', 'dt pagamento'];
const VALOR_LIQ_SYNONYMS = ['vlr liquido', 'valor liquido', 'vlr líquido', 'valor líquido'];
const VALOR_DOC_SYNONYMS = ['vlr docum', 'vlr documento', 'valor documento', 'valor', 'vlr'];
const TIPO_SYNONYMS = ['tipo'];
const CATEGORIA_SYNONYMS = ['categoria', 'classificacao', 'classificação', 'plano de contas', 'plano'];
const CODIGO_SYNONYMS = ['codigo', 'código'];

function flattenText(node) {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join(' ').trim();
  if (typeof node === 'object') {
    if (node['#text'] !== undefined) return String(node['#text']);
    return Object.values(node).map(flattenText).join(' ').trim();
  }
  return '';
}

function cellValue(cell) {
  if (!cell || typeof cell !== 'object') return '';
  if (cell['@_office:value'] !== undefined) return String(cell['@_office:value']);
  if (cell['@_office:date-value'] !== undefined) return String(cell['@_office:date-value']);
  if (cell['@_value'] !== undefined) return String(cell['@_value']);
  if (cell['@_date-value'] !== undefined) return String(cell['@_date-value']);
  return flattenText(cell['text:p'] ?? cell.p ?? '');
}

function expandRow(rowNode) {
  const cells = [];
  const raw = rowNode['table:table-cell'] ?? rowNode['table-cell'] ?? rowNode.cell;
  const list = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  for (const cell of list) {
    const repeat = Number(
      cell['@_table:number-columns-repeated']
        ?? cell['@_number-columns-repeated']
        ?? 1,
    );
    const val = cellValue(cell);
    const times = Math.min(Math.max(repeat, 1), 40);
    for (let i = 0; i < times; i += 1) cells.push(val);
  }
  return cells;
}

function buildColumnMap(headers) {
  const used = new Set();
  const nomeIdx = findColumnIndex(headers, NOME_SYNONYMS, used);
  if (nomeIdx >= 0) used.add(nomeIdx);

  const cnpjIdx = findColumnIndex(headers, CNPJ_SYNONYMS, used);
  if (cnpjIdx >= 0) used.add(cnpjIdx);

  const docIdx = findColumnIndex(headers, DOC_SYNONYMS, used);
  if (docIdx >= 0) used.add(docIdx);

  const notaIdx = findColumnIndex(headers, NOTA_SYNONYMS, used);
  if (notaIdx >= 0) used.add(notaIdx);

  const vencIdx = findColumnIndex(headers, VENC_SYNONYMS, used);
  if (vencIdx >= 0) used.add(vencIdx);

  const pagtoIdx = findColumnIndex(headers, PAGTO_SYNONYMS, used);
  if (pagtoIdx >= 0) used.add(pagtoIdx);

  const valorLiquidoIdx = findColumnIndex(headers, VALOR_LIQ_SYNONYMS, used);
  if (valorLiquidoIdx >= 0) used.add(valorLiquidoIdx);

  const valorDocIdx = findColumnIndex(headers, VALOR_DOC_SYNONYMS, used);
  if (valorDocIdx >= 0) used.add(valorDocIdx);

  const valorIdx = valorLiquidoIdx >= 0 ? valorLiquidoIdx : valorDocIdx;

  const tipoIdx = findColumnIndex(headers, TIPO_SYNONYMS, used);
  if (tipoIdx >= 0) used.add(tipoIdx);

  const categoriaIdx = findColumnIndex(headers, CATEGORIA_SYNONYMS, used);
  if (categoriaIdx >= 0) used.add(categoriaIdx);

  const codigoIdx = findColumnIndex(headers, CODIGO_SYNONYMS, used);
  if (codigoIdx >= 0) used.add(codigoIdx);

  const codigoFornIdx = findColumnIndex(headers, CODIGO_FORN_SYNONYMS, used);

  return {
    nomeIdx,
    cnpjIdx,
    docIdx,
    notaIdx,
    vencIdx,
    pagtoIdx,
    valorIdx,
    valorLiquidoIdx,
    valorDocIdx,
    tipoIdx,
    categoriaIdx,
    codigoIdx,
    codigoFornIdx,
  };
}

function resolveValor(cells, map) {
  if (map.valorLiquidoIdx >= 0) {
    const v = money(cellAt(cells, map.valorLiquidoIdx));
    if (v !== null && Math.abs(v) > 0) return v;
  }
  if (map.valorDocIdx >= 0) {
    const v = money(cellAt(cells, map.valorDocIdx));
    if (v !== null && Math.abs(v) > 0) return v;
  }
  if (map.valorIdx >= 0) {
    return money(cellAt(cells, map.valorIdx));
  }
  return null;
}

function resolveCategoria(cells, map, categoriaAtual) {
  if (map.categoriaIdx >= 0) {
    const fromCol = String(cellAt(cells, map.categoriaIdx) ?? '').trim();
    if (isValidCategoria(fromCol)) return fromCol;
  }
  // Layout BAIFER: categoria repetida na coluna 0 (antes do Codigo do cabecalho)
  const col0 = String(cells[0] ?? '').trim();
  if (isValidCategoria(col0)) return col0;

  if (isValidCategoria(categoriaAtual)) return categoriaAtual;
  return '';
}

function rowToConta(cells, map, categoriaAtual) {
  if (isTotalRow(cells)) return { _skip: true };

  const group = detectGroupLabel(cells, map);
  if (group === 'TOTAL') return { _skip: true };
  if (group) return { _group: group };

  const nome = String(cellAt(cells, map.nomeIdx) ?? '').trim();
  const cnpj = digits(cellAt(cells, map.cnpjIdx));
  const documento = String(cellAt(cells, map.docIdx) ?? '').trim();
  const nrNotaRaw = String(cellAt(cells, map.notaIdx) ?? '').trim();
  const vencimento = parseDate(cellAt(cells, map.vencIdx));
  const pagamento = parseDate(cellAt(cells, map.pagtoIdx));
  const valor = resolveValor(cells, map);
  const tipo = String(cellAt(cells, map.tipoIdx) ?? '').trim();
  const categoria = resolveCategoria(cells, map, categoriaAtual);

  return {
    categoria,
    nome,
    cnpj,
    documento,
    nrNota: normalizeNota(nrNotaRaw),
    nrNotaRaw,
    vencimento,
    pagamento,
    valor,
    tipo,
  };
}

/**
 * Parse matriz ja expandida (ODS/XLSX).
 */
function parseContasPagarMatrix(rows) {
  const required = [NOME_SYNONYMS, CNPJ_SYNONYMS, [...VALOR_LIQ_SYNONYMS, ...VALOR_DOC_SYNONYMS]];
  const found = findBestHeaderRow(rows, required);
  if (!found) {
    throw new Error(`${MSG_SEM_CONTAS} Cabecalho nao encontrado.`);
  }

  const map = buildColumnMap(found.headers);
  if (map.nomeIdx < 0 || map.valorIdx < 0) {
    throw new Error(
      `${MSG_SEM_CONTAS} Cabecalhos: [${found.headers.filter(Boolean).slice(0, 12).join(', ')}]`,
    );
  }

  const contas = [];
  let categoriaAtual = '';
  let rejected = 0;

  for (let i = found.headerIdx + 1; i < rows.length; i += 1) {
    const cells = rows[i] || [];
    const raw = rowToConta(cells, map, categoriaAtual);
    if (raw._group) {
      categoriaAtual = raw._group;
      continue;
    }
    if (raw._skip) continue;

    const checked = validateConta(raw);
    if (!checked.ok) {
      rejected += 1;
      continue;
    }
    checked.conta.id = `cp-${contas.length}`;
    contas.push(checked.conta);
  }

  assertHasContas(contas, found.headers.filter(Boolean));
  return contas;
}

async function odsToMatrix(bufferOrPath) {
  const buf = Buffer.isBuffer(bufferOrPath)
    ? bufferOrPath
    : fs.readFileSync(bufferOrPath);

  const zip = await JSZip.loadAsync(buf);
  const contentXml = await zip.file('content.xml').async('string');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: false,
  });
  const doc = parser.parse(contentXml);

  const body = doc['office:document-content']
    ?? doc['document-content']
    ?? doc;
  const spreadsheet = body['office:body']?.['office:spreadsheet']
    ?? body.body?.spreadsheet
    ?? body['office:spreadsheet'];
  const tableNode = spreadsheet?.['table:table'] ?? spreadsheet?.table;
  const table = Array.isArray(tableNode) ? tableNode[0] : tableNode;
  if (!table) throw new Error('Tabela ODS Contas a Pagar nao encontrada');

  const rowNodes = table['table:table-row'] ?? table['table-row'] ?? [];
  const list = Array.isArray(rowNodes) ? rowNodes : [rowNodes];
  return list.map(expandRow);
}

async function parseContasPagarOds(bufferOrPath) {
  const rows = await odsToMatrix(bufferOrPath);
  return parseContasPagarMatrix(rows);
}

function parseContasPagarXlsx(bufferOrPath) {
  const workbook = readWorkbook(bufferOrPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = sheetToMatrix(sheet);
  return parseContasPagarMatrix(rows);
}

async function parseContasPagar(bufferOrPath, originalName = '') {
  const name = (originalName || (typeof bufferOrPath === 'string' ? path.basename(bufferOrPath) : '')).toLowerCase();
  if (name.endsWith('.ods')) {
    return parseContasPagarOds(bufferOrPath);
  }
  if (Buffer.isBuffer(bufferOrPath) && bufferOrPath[0] === 0x50 && bufferOrPath[1] === 0x4b && name.endsWith('.ods') === false) {
    try {
      return parseContasPagarXlsx(bufferOrPath);
    } catch {
      return parseContasPagarOds(bufferOrPath);
    }
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseContasPagarXlsx(bufferOrPath);
  }
  if (typeof bufferOrPath === 'string' && bufferOrPath.toLowerCase().endsWith('.ods')) {
    return parseContasPagarOds(bufferOrPath);
  }
  try {
    return parseContasPagarXlsx(bufferOrPath);
  } catch {
    return parseContasPagarOds(bufferOrPath);
  }
}

module.exports = {
  parseContasPagar,
  parseContasPagarOds,
  parseContasPagarXlsx,
  parseContasPagarMatrix,
  buildColumnMap,
  normalizeHeader,
};

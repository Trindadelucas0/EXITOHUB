'use strict';

const ExcelJS = require('exceljs');

const BEFORE = [
  'Código',
  'Razão social',
  'UF',
  'CNPJ/CPF/CEI',
];

const AFTER = [
  'Matriz/Filial',
  'Situação',
  'Atividade CNAE',
  'CNAE secundário',
  'Tipo da atividade',
  'Contato Messenger',
  'E-mail',
  'Sócio 1',
  'Sócio 2',
  'Sócio 3',
  'Sócio 4',
  'Sócio 5',
  'Sócio 6',
  'Sócio 7',
  'Observações',
];

function regimeYears(years) {
  const set = new Set([2026, 2027]);
  for (const year of years || []) {
    const ano = Number(year);
    if (Number.isInteger(ano)) set.add(ano);
  }
  return Array.from(set).sort((a, b) => a - b);
}

function regimeHeaders(years) {
  return regimeYears(years).map((ano) => `Regime ${ano}`);
}

function regimeCell(row, ano) {
  const list = Array.isArray(row && row.regimes) ? row.regimes : [];
  const found = list.find((item) => Number(item.ano) === Number(ano));
  return found ? found.regime : '';
}

function rowToValues(row, years) {
  const anos = regimeYears(years);
  return [
    row.codigo,
    row.razao,
    row.uf,
    row.documentoFmt || row.documento,
    ...anos.map((ano) => regimeCell(row, ano)),
    row.estabelecimento,
    row.situacao,
    row.cnae,
    row.cnae_secundario,
    row.tipo,
    row.contato,
    row.email,
    row.socio_1,
    row.socio_2,
    row.socio_3,
    row.socio_4,
    row.socio_5,
    row.socio_6,
    row.socio_7,
    row.observacoes,
  ];
}

function asExcelText(value) {
  const text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) {
    return `'${text}`;
  }
  return text;
}

function columnWidth(header) {
  if (header === 'Razão social') return 36;
  if (header.indexOf('Regime ') === 0) return 42;
  if (header === 'Atividade CNAE' || header === 'CNAE secundário') return 28;
  if (header === 'Observações') return 32;
  return 18;
}

async function buildCarteiraExcelBuffer(rows, years) {
  const headers = BEFORE.concat(regimeHeaders(years), AFTER);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Carteira', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.addRow(headers);
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', wrapText: true };

  for (const row of rows) {
    const values = rowToValues(row, years).map(asExcelText);
    const excelRow = ws.addRow(values);
    excelRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.numFmt = '@';
    });
  }

  headers.forEach((header, index) => {
    ws.getColumn(index + 1).width = columnWidth(header);
  });

  if (rows.length > 0) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: headers.length },
    };
  }

  return wb.xlsx.writeBuffer();
}

module.exports = {
  buildCarteiraExcelBuffer,
  regimeHeaders,
};

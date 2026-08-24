'use strict';

const XLSX = require('xlsx');

/**
 * Alguns exports bancarios marcam !ref curto demais.
 * Expande o range com base nas celulas realmente presentes.
 */
function expandSheetRef(sheet) {
  if (!sheet || typeof sheet !== 'object') return sheet;
  let maxR = 0;
  let maxC = 0;
  for (const key of Object.keys(sheet)) {
    if (key[0] === '!') continue;
    const addr = XLSX.utils.decode_cell(key);
    if (addr.r > maxR) maxR = addr.r;
    if (addr.c > maxC) maxC = addr.c;
  }
  if (maxR > 0 || maxC > 0) {
    sheet['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: maxR, c: maxC },
    });
  }
  return sheet;
}

function readWorkbook(bufferOrPath, options = {}) {
  const workbook = XLSX.read(bufferOrPath, {
    type: Buffer.isBuffer(bufferOrPath) ? 'buffer' : 'file',
    cellDates: true,
    ...options,
  });
  for (const name of workbook.SheetNames) {
    expandSheetRef(workbook.Sheets[name]);
  }
  return workbook;
}

function sheetToMatrix(sheet) {
  expandSheetRef(sheet);
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

module.exports = {
  expandSheetRef,
  readWorkbook,
  sheetToMatrix,
  XLSX,
};

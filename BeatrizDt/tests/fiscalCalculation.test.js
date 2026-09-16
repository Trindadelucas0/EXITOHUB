const { calculateFiscalRecord, formatFiscalCell, normalizeCellValue, sanitizeNumber } = require('../services/fiscalCalculationService');
const { createInitialFiscalRecord } = require('../services/fiscalSheetSchemaService');

describe('fiscal calculation', () => {
  it('soma apenas valores numericos e preserva SALDO CREDOR', () => {
    const record = createInitialFiscalRecord();
    const calculated = calculateFiscalRecord(record);

    expect(calculated.rows[0].icms).toBe('SALDO CREDOR');
    expect(calculated.rows[3].icmsProtege).toBe(231.99);
    expect(calculated.totals.icmsProtege).toBe(231.99);
    expect(calculated.totals.icms).toBe(0);
    expect(formatFiscalCell(null)).toBe('R$ -');
    expect(formatFiscalCell('SALDO CREDOR')).toBe('SALDO CREDOR');
  });

  it('interpreta valores pt-BR e inteiros como o mesmo numero', () => {
    expect(sanitizeNumber('2268291')).toBe(2268291);
    expect(sanitizeNumber('2.268.291,00')).toBe(2268291);
    expect(sanitizeNumber('R$ 2.268.291,00')).toBe(2268291);
    expect(sanitizeNumber('22.682,91')).toBe(22682.91);

    expect(normalizeCellValue('2268291')).toBe(2268291);
    expect(normalizeCellValue('2.268.291,00')).toBe(2268291);
    expect(normalizeCellValue('R$ 2.268.291,00')).toBe(2268291);
    expect(normalizeCellValue('22.682,91')).toBe(22682.91);
    expect(normalizeCellValue('SALDO CREDOR')).toBe('SALDO CREDOR');

    expect(formatFiscalCell(2268291)).toBe('R$ 2.268.291,00');
  });
});

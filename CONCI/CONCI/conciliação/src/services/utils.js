'use strict';

/**
 * Utilitarios compartilhados de normalizacao.
 */

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function cnpjRoot(value) {
  const d = digits(value);
  return d.length >= 8 ? d.slice(0, 8) : d;
}

function money(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }
  let raw = String(value).trim();
  if (!raw) return null;

  // Remove moeda / lixo comum de planilha
  raw = raw.replace(/^\s*R\$\s*/i, '').replace(/\u00a0/g, ' ').trim();
  // Minus unicode (U+2212) usado em alguns Excel
  raw = raw.replace(/\u2212/g, '-');

  let negative = false;
  if (/^\(.*\)$/.test(raw)) {
    negative = true;
    raw = raw.slice(1, -1).trim();
  }
  if (/-\s*$/.test(raw)) {
    negative = true;
    raw = raw.replace(/-\s*$/, '').trim();
  }
  // Sufixo/prefixo D/C no mesmo campo (ex.: "50,00 D") — so remove letra; sinal fica a cargo do parser
  raw = raw.replace(/\b[DdCc]\b/g, '').trim();

  // BR: 1.234,56 ou 1234,56
  let normalized = raw;
  if (raw.includes(',') && raw.includes('.')) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (raw.includes(',')) {
    normalized = raw.replace(',', '.');
  }
  normalized = normalized.replace(/\s+/g, '');
  let n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  if (negative) n = -Math.abs(n);
  return Math.round(n * 100) / 100;
}

function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  // BR com barra (aceita hora depois): 30/04/2026 17:35
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // ISO: 2026-04-30
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  // Mercado Pago / EN: 01-06-2026 (DD-MM-YYYY) — so se o 1o grupo tem 1-2 digitos
  const brDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (brDash) {
    const [, dd, mm, yyyy] = brDash;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return null;
}

function formatDateBr(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

function normalizeNota(value) {
  if (value === null || value === undefined) return '';
  const s = String(value).trim();
  if (!s) return '';
  // Remove pontos de milhar tipicos (490.932 -> 490932) mas mantem digitos
  const only = s.replace(/[^\d]/g, '');
  return only || s;
}

function approxEqual(a, b, tol = 0.05) {
  if (a === null || b === null || a === undefined || b === undefined) return false;
  return Math.abs(Number(a) - Number(b)) <= tol;
}

function absMoney(value) {
  const m = money(value);
  return m === null ? null : Math.abs(m);
}

module.exports = {
  digits,
  cnpjRoot,
  money,
  parseDate,
  formatDateBr,
  normalizeNota,
  approxEqual,
  absMoney,
};

'use strict';

/**
 * Padrao do projeto: normalizar cabecalhos e mapear colunas por sinonimos.
 * Sem indices magicos.
 */

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeHeader(cell) {
  return stripAccents(String(cell ?? '').trim().toLowerCase())
    .replace(/\s+/g, ' ')
    .replace(/[$]/g, '')
    .replace(/\./g, '')
    .trim();
}

function matchesSynonym(normalized, synonyms) {
  if (!normalized) return false;
  return synonyms.some((syn) => {
    const s = normalizeHeader(syn);
    if (!s) return false;
    if (normalized === s) return true;
    if (normalized.startsWith(`${s} `) || normalized.startsWith(`${s}(`)) return true;
    if (normalized.includes(s) && s.length >= 8) return true;
    return false;
  });
}

function findColumnIndex(headers, synonyms, used) {
  for (let i = 0; i < headers.length; i += 1) {
    if (used.has(i)) continue;
    if (matchesSynonym(headers[i], synonyms)) return i;
  }
  return -1;
}

/**
 * Escolhe a melhor linha de cabecalho nas primeiras maxScan linhas.
 * requiredGroups: array de arrays de sinonimos; cada grupo precisa de pelo menos 1 match.
 */
function findBestHeaderRow(rows, requiredGroups, { maxScan = 40 } = {}) {
  let best = null;
  const limit = Math.min(rows.length, maxScan);

  for (let r = 0; r < limit; r += 1) {
    const headers = (rows[r] || []).map(normalizeHeader);
    if (!headers.some(Boolean)) continue;

    const used = new Set();
    let score = 0;
    const matched = [];
    for (const group of requiredGroups) {
      const idx = findColumnIndex(headers, group, used);
      if (idx >= 0) {
        used.add(idx);
        score += 1;
        matched.push(idx);
      }
    }
    if (score < Math.min(2, requiredGroups.length)) continue;
    if (!best || score > best.score) {
      best = { headerIdx: r, headers, score, matched };
    }
  }
  return best;
}

function cellAt(row, idx) {
  if (idx == null || idx < 0) return '';
  return row[idx];
}

module.exports = {
  stripAccents,
  normalizeHeader,
  matchesSynonym,
  findColumnIndex,
  findBestHeaderRow,
  cellAt,
};

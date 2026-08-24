'use strict';

const { money, parseDate } = require('../utils');

const RE_DATE_BR = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const RE_DATE_ISO = /^\d{4}-\d{2}-\d{2}/;
const RE_TIPO_DC = /^(d|c|deb|cred|debito|credito|saida|entrada)/i;
const RE_SALDO = /^SALDO/i;

const MSG_SEM_DADOS = 'Planilha sem dados utilizaveis. E obrigatorio ter colunas Data, Historico e Valor (ou Debito/Credito). Verifique o arquivo.';

function toIntOrNeg(v) {
  if (v === null || v === undefined || v === '') return -1;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : -1;
}

/**
 * Normaliza mapa vindo da IA (nomes flexiveis) para o formato interno.
 */
function normalizeAiMap(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    headerIdx: toIntOrNeg(raw.headerRow ?? raw.headerIdx ?? 0),
    dataIdx: toIntOrNeg(raw.dataCol ?? raw.dataIdx),
    histIdx: toIntOrNeg(raw.historicoCol ?? raw.histIdx ?? raw.descricaoCol),
    valorIdx: toIntOrNeg(raw.valorCol ?? raw.valorIdx),
    debitoIdx: toIntOrNeg(raw.debitoCol ?? raw.debitoIdx),
    creditoIdx: toIntOrNeg(raw.creditoCol ?? raw.creditoIdx),
    tipoIdx: toIntOrNeg(raw.tipoCol ?? raw.tipoIdx),
    razaoIdx: toIntOrNeg(raw.razaoCol ?? raw.razaoIdx),
    cnpjIdx: toIntOrNeg(raw.cnpjCol ?? raw.cnpjIdx),
    destinoIdx: toIntOrNeg(raw.destinoIdx ?? raw.destinoCol),
    origemIdx: toIntOrNeg(raw.origemIdx ?? raw.origemCol),
    destinoDocIdx: toIntOrNeg(raw.destinoDocIdx ?? raw.destinoDocumentoCol),
    origemDocIdx: toIntOrNeg(raw.origemDocIdx ?? raw.origemDocumentoCol),
    detalhamentoIdx: toIntOrNeg(raw.detalhamentoCol ?? raw.detalhamentoIdx),
    layout: raw.layout || null,
  };
}

function cellLooksLikeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
  if (typeof value === 'number' && Number.isFinite(value) && parseDate(value)) return true;
  const s = String(value ?? '').trim();
  if (!s) return false;
  if (RE_DATE_BR.test(s) || RE_DATE_ISO.test(s)) return true;
  return Boolean(parseDate(s));
}

function cellLooksLikeMoney(value) {
  return money(value) !== null;
}

function cellLooksLikeTipo(value) {
  const s = String(value ?? '').trim();
  if (!s) return false;
  return RE_TIPO_DC.test(s);
}

/**
 * Valida mapa de colunas contra amostra de linhas.
 * @returns {{ ok: boolean, error?: string, map?: object }}
 */
function validateMap(rows, mapInput) {
  const map = normalizeAiMap(mapInput) || mapInput;
  if (!map || map.dataIdx < 0 || map.histIdx < 0) {
    return { ok: false, error: 'Mapa incompleto: faltam colunas Data e/ou Historico.' };
  }

  const hasValor = map.valorIdx >= 0;
  const hasDebCred = map.debitoIdx >= 0 || map.creditoIdx >= 0;
  if (!hasValor && !hasDebCred) {
    return { ok: false, error: 'Mapa incompleto: falta Valor ou Debito/Credito.' };
  }

  const headerIdx = map.headerIdx >= 0 ? map.headerIdx : 0;
  if (headerIdx >= rows.length) {
    return { ok: false, error: 'Linha de cabecalho invalida.' };
  }

  const header = rows[headerIdx] || [];
  const maxIdx = Math.max(
    map.dataIdx,
    map.histIdx,
    map.valorIdx,
    map.debitoIdx,
    map.creditoIdx,
    map.tipoIdx,
  );
  if (maxIdx >= Math.max(header.length, ...(rows.slice(headerIdx + 1, headerIdx + 6).map((r) => (r || []).length)))) {
    // still allow if data rows are wider
  }

  let dateHits = 0;
  let moneyHits = 0;
  const sampleEnd = Math.min(rows.length, headerIdx + 12);
  for (let i = headerIdx + 1; i < sampleEnd; i += 1) {
    const row = rows[i] || [];
    if (cellLooksLikeDate(row[map.dataIdx])) dateHits += 1;
    if (hasDebCred) {
      if (cellLooksLikeMoney(row[map.debitoIdx]) || cellLooksLikeMoney(row[map.creditoIdx])) {
        moneyHits += 1;
      }
    } else if (cellLooksLikeMoney(row[map.valorIdx])) {
      moneyHits += 1;
      if (map.tipoIdx >= 0 && row[map.tipoIdx] != null && String(row[map.tipoIdx]).trim() !== '') {
        if (!cellLooksLikeTipo(row[map.tipoIdx])) {
          // tipo estranho: nao invalida o mapa inteiro se valor ok
        }
      }
    }
  }

  if (dateHits < 1 || moneyHits < 1) {
    return {
      ok: false,
      error: 'Validacao falhou: amostra nao tem Data e Valor reconheciveis nas colunas sugeridas.',
    };
  }

  return {
    ok: true,
    map: {
      dataIdx: map.dataIdx,
      histIdx: map.histIdx,
      valorIdx: map.valorIdx,
      debitoIdx: map.debitoIdx,
      creditoIdx: map.creditoIdx,
      tipoIdx: map.tipoIdx,
      razaoIdx: map.razaoIdx >= 0 ? map.razaoIdx : -1,
      cnpjIdx: map.cnpjIdx >= 0 ? map.cnpjIdx : -1,
      detalhamentoIdx: map.detalhamentoIdx >= 0 ? map.detalhamentoIdx : -1,
      headerIdx,
    },
  };
}

/**
 * Valida se um lancamento ja montado e aceitavel.
 */
function validateLancamento(item) {
  if (!item) return false;
  if (!item.data || !RE_DATE_ISO.test(String(item.data)) && !/^\d{4}-\d{2}-\d{2}$/.test(String(item.data))) {
    // parseDate always returns ISO yyyy-mm-dd
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.data || ''))) return false;
  }
  const hist = String(item.historico || '').trim();
  if (!hist || RE_SALDO.test(hist)) return false;
  if (item.valor === null || item.valor === undefined || Number.isNaN(item.valor) || item.valor === 0) {
    return false;
  }
  return true;
}

function assertHasLancamentos(lancamentos) {
  if (!lancamentos || !lancamentos.length) {
    throw new Error(MSG_SEM_DADOS);
  }
}

module.exports = {
  MSG_SEM_DADOS,
  RE_DATE_BR,
  RE_DATE_ISO,
  RE_TIPO_DC,
  RE_SALDO,
  normalizeAiMap,
  validateMap,
  validateLancamento,
  assertHasLancamentos,
  cellLooksLikeDate,
  cellLooksLikeMoney,
};

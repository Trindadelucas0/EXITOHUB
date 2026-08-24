'use strict';

/**
 * Filtros tipados por coluna e ordenacao da tela de revisao.
 */
function contains(haystack, needle) {
  if (!needle) return true;
  return String(haystack ?? '').toLowerCase().includes(String(needle).toLowerCase());
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function isPreenchido(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

function matchesPreenchido(value, option) {
  if (!option || option === 'todos') return true;
  const preenchido = isPreenchido(value);
  if (option === 'sim') return preenchido;
  if (option === 'nao') return !preenchido;
  return true;
}

function matchesDateRange(iso, de, ate) {
  if (!de && !ate) return true;
  if (!iso) return false;
  const data = String(iso);
  if (de && data < de) return false;
  if (ate && data > ate) return false;
  return true;
}

function matchesBusca(item, fBusca) {
  if (!fBusca) return true;
  return contains(item.historico, fBusca) || contains(item.classificacaoCap, fBusca);
}

function applyColumnFilters(itens, q = {}) {
  const {
    fBusca = '',
    fDataDe = '',
    fDataAte = '',
    fDebito = '',
    fDebitoPreenchido = 'todos',
    fCredito = '',
    fCreditoPreenchido = 'todos',
    fValor = '',
    fValorSinal = 'todos',
    fHistorico = '',
    fNota = '',
    fNotaPreenchido = 'todos',
    fClassificacao = '',
    fClassificacaoPreenchido = 'todos',
    fAprovado = 'todos',
  } = q;

  return itens.filter((item) => {
    if (!matchesBusca(item, fBusca)) return false;

    if (!matchesDateRange(item.data, fDataDe, fDataAte)) return false;

    if (!contains(item.debito, fDebito)) return false;
    if (!matchesPreenchido(item.debito, fDebitoPreenchido)) return false;

    if (!contains(item.credito, fCredito)) return false;
    if (!matchesPreenchido(item.credito, fCreditoPreenchido)) return false;

    if (!contains(item.valor, fValor)) return false;
    if (fValorSinal === 'positivo' && !(Number(item.valor) > 0)) return false;
    if (fValorSinal === 'negativo' && !(Number(item.valor) < 0)) return false;

    if (!contains(item.historico, fHistorico)) return false;

    if (!contains(item.numeroNota, fNota)) return false;
    if (!matchesPreenchido(item.numeroNota, fNotaPreenchido)) return false;

    if (!contains(item.classificacaoCap, fClassificacao)) return false;
    if (!matchesPreenchido(item.classificacaoCap, fClassificacaoPreenchido)) return false;

    if (fAprovado === 'sim' && !item.aprovado) return false;
    if (fAprovado === 'nao' && item.aprovado) return false;

    return true;
  });
}

const SORT_COLUMNS = ['original', 'data', 'debito', 'credito', 'valor', 'historico', 'nota', 'classificacao'];
const TEXT_SORT_COLUMNS = new Set(['historico', 'nota', 'classificacao']);

function sortFieldValue(item, col) {
  switch (col) {
    case 'data': return item.data;
    case 'debito': return item.debito;
    case 'credito': return item.credito;
    case 'valor': return item.valor;
    case 'historico': return item.historico;
    case 'nota': return item.numeroNota;
    case 'classificacao': return item.classificacaoCap;
    default: return null;
  }
}

function compareValues(a, b, col) {
  if (TEXT_SORT_COLUMNS.has(col)) {
    const sa = String(a ?? '').toLowerCase();
    const sb = String(b ?? '').toLowerCase();
    return sa.localeCompare(sb, 'pt-BR');
  }
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na === null && nb === null) return 0;
  if (na === null) return -1;
  if (nb === null) return 1;
  return na - nb;
}

/**
 * Ordena `itens` (ja filtrados) por coluna, com desempate estavel pela ordem
 * original em `originalItens` (ordem em que os lancamentos vieram do extrato).
 * `sortCol` ausente ou 'original' restaura a ordem original.
 */
function applyColumnSort(itens, originalItens, { sortCol = '', sortDir = 'asc' } = {}) {
  const originalIndex = new Map();
  (originalItens || []).forEach((item, idx) => {
    const key = item.rowId || item.id;
    if (key !== undefined && key !== null) originalIndex.set(String(key), idx);
  });

  const withIndex = itens.map((item, idx) => {
    const key = item.rowId || item.id;
    const orig = key !== undefined && key !== null && originalIndex.has(String(key))
      ? originalIndex.get(String(key))
      : idx;
    return { item, orig };
  });

  const col = SORT_COLUMNS.includes(sortCol) ? sortCol : 'original';

  if (col === 'original') {
    withIndex.sort((a, b) => a.orig - b.orig);
    return withIndex.map((w) => w.item);
  }

  const dir = sortDir === 'desc' ? -1 : 1;
  withIndex.sort((a, b) => {
    const cmp = compareValues(sortFieldValue(a.item, col), sortFieldValue(b.item, col), col);
    if (cmp !== 0) return cmp * dir;
    return a.orig - b.orig;
  });
  return withIndex.map((w) => w.item);
}

function pickColumnFilters(query = {}) {
  return {
    fBusca: query.fBusca || '',
    fDataDe: query.fDataDe || '',
    fDataAte: query.fDataAte || '',
    fDebito: query.fDebito || '',
    fDebitoPreenchido: query.fDebitoPreenchido || 'todos',
    fCredito: query.fCredito || '',
    fCreditoPreenchido: query.fCreditoPreenchido || 'todos',
    fValor: query.fValor || '',
    fValorSinal: query.fValorSinal || 'todos',
    fHistorico: query.fHistorico || '',
    fNota: query.fNota || '',
    fNotaPreenchido: query.fNotaPreenchido || 'todos',
    fClassificacao: query.fClassificacao || '',
    fClassificacaoPreenchido: query.fClassificacaoPreenchido || 'todos',
    fAprovado: query.fAprovado || 'todos',
    sortCol: SORT_COLUMNS.includes(query.sortCol) ? query.sortCol : '',
    sortDir: query.sortDir === 'desc' ? 'desc' : 'asc',
  };
}

const DEFAULT_VALUES = {
  fDebitoPreenchido: 'todos',
  fCreditoPreenchido: 'todos',
  fValorSinal: 'todos',
  fNotaPreenchido: 'todos',
  fClassificacaoPreenchido: 'todos',
  fAprovado: 'todos',
  sortDir: 'asc',
};

function columnFiltersQuery(filters) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([k, v]) => {
    if (!v) return;
    if (DEFAULT_VALUES[k] && v === DEFAULT_VALUES[k]) return;
    params.set(k, v);
  });
  return params.toString();
}

module.exports = {
  applyColumnFilters,
  applyColumnSort,
  pickColumnFilters,
  columnFiltersQuery,
  contains,
  SORT_COLUMNS,
};

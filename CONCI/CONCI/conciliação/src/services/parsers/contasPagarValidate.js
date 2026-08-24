'use strict';

const { money, parseDate, digits } = require('../utils');
const { normalizeHeader, cellAt } = require('./headerMap');

const RE_ONLY_NUMBER = /^\d+([.,]\d+)?$/;
const RE_PLAN_CODE = /^\d+(\.\d+){1,}$/;
const RE_CNPJ_LIKE = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$|^\d{11}$|^\d{14}$/;
const RE_TOTAL = /total\s+do\s+plano|\btotal\b/i;

const MSG_SEM_CONTAS = 'Contas a Pagar sem dados utilizaveis. Verifique cabecalho (Nome, CNPJ, Valor, Datas) e classificacao.';

function looksLikeCnpj(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  if (RE_CNPJ_LIKE.test(s)) return true;
  const d = digits(s);
  return d.length === 11 || d.length === 14;
}

function isNumericCode(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  return RE_ONLY_NUMBER.test(s) || RE_PLAN_CODE.test(s);
}

function isValidCategoria(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  if (isNumericCode(s)) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(s)) return false;
  if (s.length < 2) return false;
  return true;
}

function isTotalRow(cells) {
  const joined = (cells || []).map((c) => String(c ?? '').trim()).filter(Boolean).join(' ');
  return RE_TOTAL.test(joined);
}

/**
 * Linha de grupo Santri: codigo do plano + rotulo (BOLETOS, FORNECEDORES...),
 * sem CNPJ e sem valor de documento.
 */
function detectGroupLabel(cells, map) {
  if (!cells || !cells.length) return null;
  if (isTotalRow(cells)) return 'TOTAL';

  const filled = cells.filter((c) => String(c ?? '').trim() !== '').length;
  const cnpjRaw = cellAt(cells, map.cnpjIdx);
  const cnpj = digits(cnpjRaw);
  const valor = money(cellAt(cells, map.valorIdx));
  const liquido = map.valorLiquidoIdx >= 0 ? money(cellAt(cells, map.valorLiquidoIdx)) : null;
  const hasValor = (valor !== null && Math.abs(valor) > 0)
    || (liquido !== null && Math.abs(liquido) > 0);

  if (cnpj.length >= 11 || hasValor) return null;
  if (filled > 6) return null;

  let hasPlanCode = false;
  let label = null;
  for (const c of cells) {
    const s = String(c ?? '').trim();
    if (!s) continue;
    if (RE_PLAN_CODE.test(s)) {
      hasPlanCode = true;
      continue;
    }
    if (isValidCategoria(s) && !looksLikeCnpj(s)) {
      label = s;
    }
  }

  if (hasPlanCode && label) return label;
  // Grupo curto so com rotulo (raro)
  if (filled <= 3 && label && !cnpj) return label;
  return null;
}

function swapNomeCnpjIfNeeded(nome, cnpj) {
  let n = String(nome ?? '').trim();
  let c = digits(cnpj);
  if (looksLikeCnpj(n) && c.length < 11) {
    c = digits(n);
    n = '';
  }
  return { nome: n, cnpj: c };
}

/**
 * Valida conta candidata. Retorna { ok, error?, conta? }.
 */
function validateConta(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'linha vazia' };
  }

  if (raw._skip) {
    return { ok: false, error: 'ignorada' };
  }

  let { nome, cnpj } = swapNomeCnpjIfNeeded(raw.nome, raw.cnpj);
  const categoria = String(raw.categoria ?? '').trim();
  const valor = raw.valor;
  const vencimento = raw.vencimento;
  const pagamento = raw.pagamento;

  // 1. Identidade
  if (!nome && !(cnpj.length === 11 || cnpj.length === 14)) {
    return { ok: false, error: 'sem nome/cnpj' };
  }

  // 2. Valor
  if (valor === null || valor === undefined || Number.isNaN(valor) || Math.abs(valor) === 0) {
    return { ok: false, error: 'sem valor' };
  }

  // 3. Data
  if (!vencimento && !pagamento) {
    return { ok: false, error: 'sem data' };
  }

  // 4. Categoria
  if (!isValidCategoria(categoria)) {
    return { ok: false, error: 'categoria invalida' };
  }

  // 5. Nome nao pode ser so cabecalho/lixo
  const nomeNorm = normalizeHeader(nome);
  if (nomeNorm === 'nome do cliente/fornecedor' || nomeNorm === 'cliente/fornecedor') {
    return { ok: false, error: 'nome cabecalho' };
  }

  return {
    ok: true,
    conta: {
      ...raw,
      nome,
      cnpj,
      categoria,
      valor,
      vencimento: vencimento || null,
      pagamento: pagamento || null,
    },
  };
}

function assertHasContas(contas, headersFound) {
  if (contas && contas.length > 0) return;
  const sample = (headersFound || []).slice(0, 10).join(', ') || 'nenhum';
  throw new Error(`${MSG_SEM_CONTAS} Cabecalhos: [${sample}]`);
}

module.exports = {
  MSG_SEM_CONTAS,
  RE_ONLY_NUMBER,
  RE_PLAN_CODE,
  looksLikeCnpj,
  isNumericCode,
  isValidCategoria,
  isTotalRow,
  detectGroupLabel,
  swapNomeCnpjIfNeeded,
  validateConta,
  assertHasContas,
};

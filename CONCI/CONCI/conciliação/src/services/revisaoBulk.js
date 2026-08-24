'use strict';

const { applyPreCadastro } = require('./preCadastroStore');

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function normalizeRowIds(raw) {
  if (raw == null || raw === '') return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return [...new Set(list.map((id) => String(id || '').trim()).filter(Boolean))];
}

function itemKey(item) {
  return String(item.rowId || item.id || '');
}

function matchesRowId(item, idSet) {
  return idSet.has(itemKey(item));
}

/**
 * Aplica CAP + pré-cadastro (mesma regra do Salvar individual).
 */
function applyCapAndPre(item, cap, preKey) {
  const next = {
    ...item,
    classificacaoCap: String(cap ?? '').trim(),
    categoria: String(cap ?? '').trim(),
  };
  const withPre = applyPreCadastro(next, preKey);
  return {
    ...next,
    classificacaoCap: withPre.classificacaoCap,
    categoria: withPre.categoria,
    debito: withPre.debito,
    credito: withPre.credito,
    preCadastroId: withPre.preCadastroId,
    motivo: withPre.motivo,
    error: null,
  };
}

/**
 * Reaplica pré-cadastro mantendo a CAP atual do item.
 */
function reapplyPreOnItem(item, preKey) {
  const withPre = applyPreCadastro({ ...item }, preKey);
  return {
    ...item,
    classificacaoCap: withPre.classificacaoCap ?? item.classificacaoCap,
    categoria: withPre.categoria ?? item.categoria,
    debito: withPre.debito,
    credito: withPre.credito,
    preCadastroId: withPre.preCadastroId,
    motivo: withPre.motivo,
    error: null,
  };
}

function excludeItems(itens, rowIds) {
  const ids = new Set(normalizeRowIds(rowIds));
  if (!ids.size) return { itens: [...itens], removed: 0 };
  const next = itens.filter((item) => !matchesRowId(item, ids));
  return { itens: next, removed: itens.length - next.length };
}

/**
 * Se rowIds vazio, reaplica em todos; senão só nos selecionados.
 */
function reapplyPreCadastroItems(itens, preKey, rowIds) {
  const ids = new Set(normalizeRowIds(rowIds));
  const applyAll = ids.size === 0;
  let updated = 0;
  const next = itens.map((item) => {
    if (!applyAll && !matchesRowId(item, ids)) return item;
    updated += 1;
    return reapplyPreOnItem(item, preKey);
  });
  return { itens: next, updated };
}

function applyCapLote(itens, rowIds, classificacaoCap, preKey) {
  const ids = new Set(normalizeRowIds(rowIds));
  if (!ids.size) {
    return { itens: [...itens], updated: 0, error: 'Selecione ao menos um lancamento' };
  }
  const cap = String(classificacaoCap ?? '').trim();
  if (!cap) {
    return { itens: [...itens], updated: 0, error: 'Informe a Classificação Êxito' };
  }
  let updated = 0;
  const next = itens.map((item) => {
    if (!matchesRowId(item, ids)) return item;
    updated += 1;
    return applyCapAndPre(item, cap, preKey);
  });
  return { itens: next, updated, error: null };
}

module.exports = {
  normalizeRowIds,
  applyCapAndPre,
  reapplyPreOnItem,
  excludeItems,
  reapplyPreCadastroItems,
  applyCapLote,
};

'use strict';

const { absMoney } = require('../utils');
const {
  applyContaMatch,
  buildIndex,
  sameDate,
  sameCnpj,
  nameOverlapsHistorico,
} = require('./pass1');

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/**
 * Pagamentos genericos do extrato sem fornecedor no historico —
 * nao devem casar Contas a Pagar so por valor/data.
 */
function isPagamentoGenericoSemFornecedor(pag) {
  const h = stripAccents(pag.historico || '');
  if (!h) return true;
  return /PIX ENVIAD|SISPAG|APL APLIC|APLIC AUT|SALARIO/.test(h);
}

/**
 * valor_unico so e seguro quando o historico parece pagamento a fornecedor
 * (boleto/pagamento), nao PIX generico / aplicacao / salario.
 */
function looksLikeFornecedorPagamento(pag) {
  const h = stripAccents(pag.historico || '');
  if (!h) return false;
  if (isPagamentoGenericoSemFornecedor(pag)) return false;
  if (/TRIBUTO|DARF|FGTS|CONCESSIONARIA/.test(h) && !/BOLETO/.test(h)) return false;
  if (/BOLETO PAGO|PAGAMENTO|\bBOLETO\b/.test(h)) return true;
  return false;
}

/**
 * Passagem 2: residual — valor+nome (historico), valor+cnpj, valor+data unica, valor unico.
 * Extrato tipico so tem VALOR + HISTORICO; prioriza nome no historico para CAP correta.
 */
function pass2(residual, contas, used) {
  const byValor = buildIndex(contas);
  const results = [];
  const still = [];

  for (const pag of residual) {
    const v = absMoney(pag.valor);
    if (v === null) {
      still.push(pag);
      continue;
    }
    const cands = (byValor.get(v.toFixed(2)) || []).filter((c) => !used.has(c.id));

    let match = null;
    let motivo = '';

    const byName = cands.filter((c) => nameOverlapsHistorico(pag, c));
    if (byName.length === 1) {
      match = byName[0];
      motivo = 'valor+nome';
    } else if (byName.length > 1) {
      const withDate = byName.filter(
        (c) => sameDate(pag.data, c.pagamento) || sameDate(pag.data, c.vencimento),
      );
      if (withDate.length === 1) {
        match = withDate[0];
        motivo = 'valor+nome+data';
      }
    }

    if (!match) {
      match = cands.find((c) => sameCnpj(pag.cnpj, c.cnpj));
      if (match) motivo = 'valor+cnpj';
    }

    if (!match && !isPagamentoGenericoSemFornecedor(pag)) {
      const byDate = cands.filter(
        (c) => sameDate(pag.data, c.pagamento) || sameDate(pag.data, c.vencimento),
      );
      if (byDate.length === 1) {
        match = byDate[0];
        motivo = 'valor+data';
      }
    }

    // valor_unico so se o historico indica boleto/pagamento a fornecedor
    // (evita PIX ENVIADO / aplicacao casarem conta aleatoria)
    if (!match && cands.length === 1 && looksLikeFornecedorPagamento(pag)) {
      match = cands[0];
      motivo = 'valor_unico';
    }

    if (match) {
      used.add(match.id);
      results.push(applyContaMatch(pag, match, 'SUGERIDO', 2, motivo));
    } else {
      still.push(pag);
    }
  }

  return { results, residual: still, used };
}

module.exports = { pass2, looksLikeFornecedorPagamento };

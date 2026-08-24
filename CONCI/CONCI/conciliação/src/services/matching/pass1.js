'use strict';

const mapa = require('../../config/mapaContas.json');
const { cnpjRoot, absMoney, normalizeNota } = require('../utils');

/**
 * Match Contas a Pagar. Debito/Credito ficam null aqui;
 * preenchidos depois pelo pre-cadastro da sessao.
 */
function applyContaMatch(pagamento, conta, status, passagem, motivo) {
  const classificacaoCap = conta.categoria || '';
  const numeroNota = conta.nrNota ? normalizeNota(conta.nrNota) : '';

  return {
    ...pagamento,
    tipo: 'pagamento',
    status,
    passagem,
    motivo,
    categoria: classificacaoCap,
    classificacaoCap,
    fornecedor: conta.nome || pagamento.razaoSocial || '',
    debito: null,
    credito: null,
    preCadastroId: null,
    numeroNota,
    contaPagarId: conta.id,
    aprovado: false,
  };
}

function buildIndex(contas) {
  const byValor = new Map();
  for (const c of contas) {
    if (c.valor === null || c.valor === undefined) continue;
    const key = absMoney(c.valor);
    if (key === null) continue;
    const k = key.toFixed(2);
    if (!byValor.has(k)) byValor.set(k, []);
    byValor.get(k).push(c);
  }
  return byValor;
}

function sameDate(a, b) {
  return a && b && a === b;
}

function sameCnpj(a, b) {
  const ra = cnpjRoot(a);
  const rb = cnpjRoot(b);
  return ra && rb && ra === rb;
}

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

const STOP_NAME = new Set([
  'LTDA', 'EIRELI', 'ME', 'EPP', 'SA', 'S/A', 'SS', 'CIA', 'COM', 'DE', 'DA', 'DO', 'DAS', 'DOS',
  'E', 'THE', 'INC', 'LLC',
]);

/**
 * Extrato costuma trazer so pedaco do nome no historico (ex.: BOLETO PAGO MENEGOTTI).
 */
function nameOverlapsHistorico(pagamento, conta) {
  const hist = stripAccents(pagamento.historico || '');
  const razao = stripAccents(pagamento.razaoSocial || '');
  const hay = `${hist} ${razao}`.trim();
  if (!hay) return false;

  const nome = stripAccents(conta.nome || '');
  if (!nome || nome.length < 4) return false;

  const tokens = nome
    .split(/[^A-Z0-9]+/)
    .filter((t) => t.length >= 4 && !STOP_NAME.has(t));
  if (!tokens.length) return false;

  // 1 token forte basta; se houver 2+, exige o primeiro
  if (hay.includes(tokens[0])) return true;
  return tokens.filter((t) => hay.includes(t)).length >= 2;
}

function pass1(pagamentos, contas) {
  const byValor = buildIndex(contas);
  const used = new Set();
  const results = [];
  const residual = [];

  for (const pag of pagamentos) {
    const v = absMoney(pag.valor);
    if (v === null) {
      residual.push(pag);
      continue;
    }
    const cands = (byValor.get(v.toFixed(2)) || []).filter((c) => !used.has(c.id));
    const match = cands.find(
      (c) =>
        sameCnpj(pag.cnpj, c.cnpj)
        && (sameDate(pag.data, c.pagamento) || sameDate(pag.data, c.vencimento)),
    );

    if (match) {
      used.add(match.id);
      results.push(applyContaMatch(pag, match, 'MATCHED', 1, 'valor+data+cnpj'));
    } else {
      residual.push(pag);
    }
  }

  return { results, residual, used };
}

module.exports = {
  pass1,
  applyContaMatch,
  buildIndex,
  sameDate,
  sameCnpj,
  nameOverlapsHistorico,
  mapa,
};

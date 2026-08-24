'use strict';

const { pass1 } = require('./pass1');
const { pass2 } = require('./pass2');
const { pass3 } = require('./pass3');
const {
  applyPreCadastro,
  findBestPreByHistorico,
  CLASSIFICACAO_RECEBIMENTO,
} = require('../preCadastroStore');

function asRecebimento(lancamento, idx, sessionId) {
  return applyPreCadastro({
    ...lancamento,
    tipo: 'recebimento',
    status: 'RECEBIMENTO',
    passagem: 0,
    motivo: '',
    categoria: CLASSIFICACAO_RECEBIMENTO,
    classificacaoCap: CLASSIFICACAO_RECEBIMENTO,
    fornecedor: lancamento.razaoSocial || '',
    debito: null,
    credito: null,
    numeroNota: '',
    contaPagarId: null,
    aprovado: false,
    rowId: lancamento.id || `rec-${idx}`,
  }, sessionId);
}

/**
 * Residual sem CAP: tenta casar historico do extrato com descricao do pre-cadastro.
 */
function enrichCapFromHistorico(item, sessionId) {
  const cap = String(item.classificacaoCap || item.categoria || '').trim();
  if (cap) return item;
  const pre = findBestPreByHistorico(sessionId, item.historico);
  if (!pre) return item;
  return {
    ...item,
    classificacaoCap: pre.descricao,
    categoria: pre.descricao,
    status: 'SUGERIDO',
    passagem: 3,
    motivo: 'historico+precadastro',
  };
}

function shouldAutoAprovar(item) {
  if (!item.preCadastroId) return false;
  if (item.debito == null && item.credito == null) return false;
  if (item.status === 'MATCHED' || item.status === 'REGRA') return true;
  return item.status === 'SUGERIDO' && item.motivo === 'historico+precadastro';
}

/**
 * Orquestra 3 passagens. Debito/Credito via pre-cadastro da sessao.
 */
function runMatching({
  lancamentos,
  pagamentos,
  recebimentos,
  contas,
  sessionId,
}) {
  let lista;
  if (lancamentos && lancamentos.length) {
    lista = lancamentos.map((l) => ({ ...l }));
  } else {
    lista = [
      ...(pagamentos || []).map((l) => ({ ...l })),
      ...(recebimentos || []).map((l) => ({ ...l })),
    ];
  }

  const pags = lista.filter((l) => l.valor < 0);
  const p1 = pass1(pags, contas || []);
  const p2 = pass2(p1.residual, contas || [], p1.used);
  const p3 = pass3(p2.residual, [...p1.results, ...p2.results]);

  const byId = new Map();
  for (const item of p3.results) {
    const enriched = enrichCapFromHistorico(item, sessionId);
    byId.set(item.id, applyPreCadastro(enriched, sessionId));
  }

  const itens = lista.map((lanc, idx) => {
    if (lanc.valor > 0) {
      return asRecebimento(lanc, idx, sessionId);
    }
    if (lanc.valor < 0) {
      const matched = byId.get(lanc.id);
      if (!matched) {
        throw new Error(`Pagamento sem resultado no matching: ${lanc.historico}`);
      }
      const withPre = applyPreCadastro({
        ...matched,
        tipo: 'pagamento',
        rowId: matched.id || `pag-${idx}`,
        classificacaoCap: matched.classificacaoCap ?? '',
        numeroNota: matched.numeroNota ?? '',
      }, sessionId);

      if (shouldAutoAprovar(withPre)) {
        withPre.aprovado = true;
      }
      return withPre;
    }
    return asRecebimento(lanc, idx, sessionId);
  });

  const pagamentosOut = itens.filter((i) => i.tipo === 'pagamento');
  if (pagamentosOut.length !== pags.length) {
    throw new Error(
      `Falha de cobertura pagamentos: expected=${pags.length} got=${pagamentosOut.length}`,
    );
  }

  for (const item of itens) {
    if (item.numeroNota === undefined || item.numeroNota === null) {
      throw new Error(`numeroNota indefinido em ${item.historico}`);
    }
    if (item.classificacaoCap === undefined || item.classificacaoCap === null) {
      throw new Error(`classificacaoCap indefinido em ${item.historico}`);
    }
    if (!item.status) {
      throw new Error(`status ausente em ${item.historico}`);
    }
  }

  const resumo = {
    total: itens.length,
    pagamentos: pagamentosOut.length,
    recebimentos: itens.filter((i) => i.tipo === 'recebimento').length,
    matched: itens.filter((i) => i.status === 'MATCHED').length,
    sugerido: itens.filter((i) => i.status === 'SUGERIDO').length,
    regra: itens.filter((i) => i.status === 'REGRA').length,
    semMatch: itens.filter((i) => i.status === 'SEM_MATCH').length,
    comClassificacao: itens.filter((i) => i.classificacaoCap).length,
    comNota: itens.filter((i) => i.numeroNota).length,
    aprovados: itens.filter((i) => i.aprovado).length,
  };

  return { itens, resumo };
}

module.exports = { runMatching };

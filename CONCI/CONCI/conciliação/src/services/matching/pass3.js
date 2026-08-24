'use strict';

const mapa = require('../../config/mapaContas.json');

/**
 * Marca tarifas por historico. Codigos so via pre-cadastro TARIFAS BANCARIAS.
 */
function applyRegrasHistorico(pag) {
  const hist = String(pag.historico || '');
  for (const regra of mapa.regrasHistorico || []) {
    const re = new RegExp(regra.pattern, 'i');
    if (re.test(hist)) {
      return {
        ...pag,
        tipo: 'pagamento',
        status: 'REGRA',
        passagem: 3,
        motivo: regra.label || regra.pattern,
        categoria: regra.preCadastroDescricao || regra.label || 'TARIFAS BANCARIAS',
        classificacaoCap: regra.preCadastroDescricao || regra.label || 'TARIFAS BANCARIAS',
        fornecedor: pag.razaoSocial || '',
        debito: null,
        credito: null,
        numeroNota: '',
        contaPagarId: null,
        aprovado: false,
        regraPreCadastro: regra.preCadastroDescricao || regra.label || 'TARIFAS BANCARIAS',
      };
    }
  }
  return null;
}

/**
 * Passagem 3: tarifas por historico + residual SEM_MATCH.
 * Nº nota vem do Contas a Pagar (pass1/pass2) ou edicao manual na revisao.
 */
function pass3(residual, classificados) {
  const results = [];
  const still = [];

  for (const pag of residual) {
    const regra = applyRegrasHistorico(pag);
    if (regra) {
      results.push(regra);
    } else {
      still.push(pag);
    }
  }

  for (const pag of still) {
    results.push({
      ...pag,
      tipo: 'pagamento',
      status: 'SEM_MATCH',
      passagem: 3,
      motivo: 'sem-match',
      categoria: '',
      classificacaoCap: '',
      fornecedor: pag.razaoSocial || '',
      debito: null,
      credito: null,
      numeroNota: '',
      contaPagarId: null,
      aprovado: false,
    });
  }

  const all = [...classificados, ...results].map((item) => ({
    ...item,
    classificacaoCap: item.classificacaoCap ?? item.categoria ?? '',
    numeroNota: item.numeroNota || '',
  }));

  return { results: all };
}

module.exports = {
  pass3,
  applyRegrasHistorico,
};

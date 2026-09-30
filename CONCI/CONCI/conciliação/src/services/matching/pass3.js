'use strict';

/**
 * Passagem 3: residual SEM_MATCH (inclusive tarifas TAR/CUSTAS e TARIFA).
 * Classificacao do residual vem depois, pelos historicos do pre-cadastro.
 * Nº nota vem do Contas a Pagar (pass1/pass2) ou edicao manual na revisao.
 */
function pass3(residual, classificados) {
  const results = residual.map((pag) => ({
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
  }));

  const all = [...classificados, ...results].map((item) => ({
    ...item,
    classificacaoCap: item.classificacaoCap ?? item.categoria ?? '',
    numeroNota: item.numeroNota || '',
  }));

  return { results: all };
}

module.exports = {
  pass3,
};

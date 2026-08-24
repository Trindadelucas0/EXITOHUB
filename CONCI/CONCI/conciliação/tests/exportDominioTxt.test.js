'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { exportDominioTxt } = require('../src/services/exportDominio');

function fakeItens() {
  return [
    {
      data: '2026-04-01',
      debito: 8,
      credito: 1000,
      valor: 1543.84,
      historico: 'Cielo Vendas Débito',
      numeroNota: '',
    },
    {
      data: '2026-04-01',
      debito: null,
      credito: 8,
      valor: 2552.02,
      historico: 'FCO Liberação',
      numeroNota: '',
    },
    {
      data: '2026-04-02',
      debito: 1004,
      credito: 8,
      valor: 1530.02,
      historico: 'Pagamento de Boleto - STIHL FERRAMENTAS MOTORIZADAS',
      numeroNota: '1441026',
    },
  ];
}

describe('exportDominioTxt', () => {
  it('gera linhas no layout Data;Debito;Credito;Valor;;Historico separadas por CRLF', () => {
    const buffer = exportDominioTxt(fakeItens());
    assert.ok(Buffer.isBuffer(buffer));

    const texto = buffer.toString('latin1');
    const linhas = texto.split('\r\n').filter((l) => l.length > 0);

    assert.equal(linhas.length, 3);
    assert.equal(linhas[0], '01/04/2026;8;1000;1543,84;;Cielo Vendas Débito');
    assert.equal(linhas[2], '02/04/2026;1004;8;1530,02;;Pagamento de Boleto - STIHL FERRAMENTAS MOTORIZADAS | NF 1441026');
  });

  it('usa campo vazio quando debito/credito sao nulos', () => {
    const buffer = exportDominioTxt(fakeItens());
    const linhas = buffer.toString('latin1').split('\r\n').filter((l) => l.length > 0);

    assert.equal(linhas[1], '01/04/2026;;8;2552,02;;FCO Liberação');
  });

  it('termina o arquivo com CRLF e nao gera cabecalho', () => {
    const buffer = exportDominioTxt(fakeItens());
    const texto = buffer.toString('latin1');

    assert.ok(texto.endsWith('\r\n'));
    assert.ok(!texto.startsWith('Data;'));
  });

  it('retorna buffer vazio quando nao ha itens', () => {
    const buffer = exportDominioTxt([]);
    assert.equal(buffer.length, 0);
  });

  it('remove o sinal negativo do valor (pagamentos vem com valor negativo no extrato)', () => {
    const buffer = exportDominioTxt([{
      data: '2026-04-01',
      debito: 1004,
      credito: 8,
      valor: -1543.84,
      historico: 'Pagamento de Boleto',
      numeroNota: '',
    }]);
    const linhas = buffer.toString('latin1').split('\r\n').filter((l) => l.length > 0);

    assert.equal(linhas[0], '01/04/2026;1004;8;1543,84;;Pagamento de Boleto');
  });

  it('nunca gera sinal negativo na coluna Valor para qualquer banco', () => {
    // Export TXT e unico e agnostico ao banco: todos passam por valorTxt(Math.abs).
    const itensPorBanco = [
      { data: '2026-04-01', debito: 1004, credito: 9, valor: -1648.58, historico: 'ITAU BOLETO PAGO' },
      { data: '2026-04-01', debito: 1025, credito: 8, valor: -1.89, historico: 'BB TAR/CUSTAS COBRANCA' },
      { data: '2026-04-01', debito: 1004, credito: 9, valor: -55.88, historico: 'STONE Pix enviado' },
      { data: '2026-04-01', debito: null, credito: null, valor: -450.03, historico: 'MP Dinheiro retido' },
      { data: '2026-04-01', debito: 8, credito: 1000, valor: 1543.84, historico: 'ITAU Cielo Vendas' },
      { data: '2026-04-01', debito: 9, credito: 101, valor: 217.88, historico: 'MP Liberação de dinheiro' },
    ];

    const linhas = exportDominioTxt(itensPorBanco)
      .toString('latin1')
      .split('\r\n')
      .filter((l) => l.length > 0);

    assert.equal(linhas.length, itensPorBanco.length);
    for (const linha of linhas) {
      const valorCampo = linha.split(';')[3];
      assert.ok(valorCampo, `linha sem valor: ${linha}`);
      assert.ok(!valorCampo.includes('-'), `Valor com sinal negativo: ${linha}`);
      assert.match(valorCampo, /^\d+,\d{2}$/);
    }

    assert.equal(linhas[0].split(';')[3], '1648,58');
    assert.equal(linhas[1].split(';')[3], '1,89');
    assert.equal(linhas[2].split(';')[3], '55,88');
    assert.equal(linhas[3].split(';')[3], '450,03');
  });
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  applyColumnFilters,
  applyColumnSort,
  pickColumnFilters,
  columnFiltersQuery,
} = require('../src/services/columnFilters');

function item(overrides) {
  return {
    rowId: 'r0',
    data: '2026-04-01',
    debito: null,
    credito: null,
    valor: 0,
    historico: '',
    numeroNota: '',
    classificacaoCap: '',
    aprovado: false,
    ...overrides,
  };
}

describe('applyColumnFilters', () => {
  it('filtra por intervalo de data', () => {
    const itens = [
      item({ rowId: 'a', data: '2026-04-01' }),
      item({ rowId: 'b', data: '2026-04-15' }),
      item({ rowId: 'c', data: '2026-04-30' }),
    ];
    const filtrado = applyColumnFilters(itens, { fDataDe: '2026-04-10', fDataAte: '2026-04-20' });
    assert.deepEqual(filtrado.map((i) => i.rowId), ['b']);
  });

  it('filtra valor positivo e negativo', () => {
    const itens = [
      item({ rowId: 'a', valor: -50 }),
      item({ rowId: 'b', valor: 50 }),
    ];
    assert.deepEqual(applyColumnFilters(itens, { fValorSinal: 'positivo' }).map((i) => i.rowId), ['b']);
    assert.deepEqual(applyColumnFilters(itens, { fValorSinal: 'negativo' }).map((i) => i.rowId), ['a']);
  });

  it('filtra debito por codigo e por preenchido/vazio', () => {
    const itens = [
      item({ rowId: 'a', debito: 1001 }),
      item({ rowId: 'b', debito: 2005 }),
      item({ rowId: 'c', debito: null }),
    ];
    assert.deepEqual(
      applyColumnFilters(itens, { fDebito: '2005' }).map((i) => i.rowId),
      ['b'],
    );
    assert.deepEqual(
      applyColumnFilters(itens, { fDebito: '100' }).map((i) => i.rowId),
      ['a'],
    );
    assert.deepEqual(
      applyColumnFilters(itens, { fDebitoPreenchido: 'nao' }).map((i) => i.rowId),
      ['c'],
    );
    assert.deepEqual(
      applyColumnFilters(itens, { fDebitoPreenchido: 'sim' }).map((i) => i.rowId),
      ['a', 'b'],
    );
  });

  it('filtra por aprovado sim/nao', () => {
    const itens = [
      item({ rowId: 'a', aprovado: true }),
      item({ rowId: 'b', aprovado: false }),
    ];
    assert.deepEqual(applyColumnFilters(itens, { fAprovado: 'sim' }).map((i) => i.rowId), ['a']);
    assert.deepEqual(applyColumnFilters(itens, { fAprovado: 'nao' }).map((i) => i.rowId), ['b']);
  });

  it('mantem compatibilidade com filtro de texto por Classificacao CAP', () => {
    const itens = [
      item({ rowId: 'a', classificacaoCap: 'FORNECEDORES' }),
      item({ rowId: 'b', classificacaoCap: 'ENERGIA' }),
    ];
    const filtrado = applyColumnFilters(itens, { fClassificacao: 'ENERGIA' });
    assert.equal(filtrado.length, 1);
    assert.equal(filtrado[0].classificacaoCap, 'ENERGIA');
  });

  it('fBusca casa historico OU classificacao Cap (contains, case-insensitive)', () => {
    const itens = [
      item({ rowId: 'a', historico: 'PIX ENERGIA CEMIG', classificacaoCap: '' }),
      item({ rowId: 'b', historico: 'TED FORNECEDOR', classificacaoCap: 'ENERGIA' }),
      item({ rowId: 'c', historico: 'TARIFA', classificacaoCap: 'TARIFAS BANCARIAS' }),
    ];
    assert.deepEqual(
      applyColumnFilters(itens, { fBusca: 'energia' }).map((i) => i.rowId),
      ['a', 'b'],
    );
    assert.deepEqual(
      applyColumnFilters(itens, { fBusca: 'TARIFA' }).map((i) => i.rowId),
      ['c'],
    );
  });
});

describe('columnFiltersQuery', () => {
  it('inclui fBusca e omite defaults "todos"', () => {
    const qs = columnFiltersQuery({
      fBusca: 'energia',
      fDebitoPreenchido: 'todos',
      fAprovado: 'todos',
      sortDir: 'asc',
    });
    assert.ok(qs.includes('fBusca=energia'));
    assert.ok(!qs.includes('fDebitoPreenchido'));
    assert.ok(!qs.includes('fAprovado'));
  });
});

describe('applyColumnSort', () => {
  const originalItens = [
    item({ rowId: 'a', valor: 300, historico: 'ZEBRA' }),
    item({ rowId: 'b', valor: 100, historico: 'ABACAXI' }),
    item({ rowId: 'c', valor: 200, historico: 'MANGA' }),
  ];

  it('ordena por valor crescente e decrescente', () => {
    const asc = applyColumnSort(originalItens.slice(), originalItens, { sortCol: 'valor', sortDir: 'asc' });
    assert.deepEqual(asc.map((i) => i.rowId), ['b', 'c', 'a']);

    const desc = applyColumnSort(originalItens.slice(), originalItens, { sortCol: 'valor', sortDir: 'desc' });
    assert.deepEqual(desc.map((i) => i.rowId), ['a', 'c', 'b']);
  });

  it('ordena por historico em ordem alfabetica pt-BR', () => {
    const asc = applyColumnSort(originalItens.slice(), originalItens, { sortCol: 'historico', sortDir: 'asc' });
    assert.deepEqual(asc.map((i) => i.rowId), ['b', 'c', 'a']);
  });

  it('sem sortCol (ou "original") restaura a ordem original mesmo apos filtrar', () => {
    const filtrados = [originalItens[2], originalItens[0]];
    const ordenados = applyColumnSort(filtrados, originalItens, {});
    assert.deepEqual(ordenados.map((i) => i.rowId), ['a', 'c']);

    const explicito = applyColumnSort(filtrados, originalItens, { sortCol: 'original' });
    assert.deepEqual(explicito.map((i) => i.rowId), ['a', 'c']);
  });
});

describe('pickColumnFilters', () => {
  it('aplica valores padrao "todos" e sortDir "asc" quando ausentes', () => {
    const picked = pickColumnFilters({});
    assert.equal(picked.fBusca, '');
    assert.equal(picked.fDebitoPreenchido, 'todos');
    assert.equal(picked.fValorSinal, 'todos');
    assert.equal(picked.fAprovado, 'todos');
    assert.equal(picked.sortDir, 'asc');
    assert.equal(picked.sortCol, '');
  });

  it('ignora sortCol invalido', () => {
    const picked = pickColumnFilters({ sortCol: 'coluna-inexistente' });
    assert.equal(picked.sortCol, '');
  });

  it('preserva fBusca da query', () => {
    const picked = pickColumnFilters({ fBusca: 'FRETE' });
    assert.equal(picked.fBusca, 'FRETE');
  });
});

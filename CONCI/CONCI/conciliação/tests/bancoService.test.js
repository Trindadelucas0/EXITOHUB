'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const calls = [];
let nextRows = [];

const poolPath = require.resolve('../src/db/pool');
require.cache[poolPath] = {
  id: poolPath,
  filename: poolPath,
  loaded: true,
  exports: {
    query: async (text, params) => {
      calls.push({ text, params });
      return { rows: nextRows };
    },
  },
};

const {
  listBancos,
  getBancoDaEmpresa,
  getFirstActiveBanco,
  createBanco,
  updateBanco,
} = require('../src/services/bancoService');

const EMPRESA_A = '11111111-1111-1111-1111-111111111111';
const EMPRESA_B = '22222222-2222-2222-2222-222222222222';

function row(over = {}) {
  return {
    id: 'b1',
    nome: 'ITAU BAIFER',
    codigo_credito: 9,
    ativo: true,
    created_at: null,
    empresa_id: EMPRESA_A,
    empresa_nome: 'BAIFER',
    ...over,
  };
}

beforeEach(() => {
  calls.length = 0;
  nextRows = [];
});

describe('bancoService — banco por empresa', () => {
  it('listBancos com empresaId filtra pela empresa e por ativo', async () => {
    nextRows = [row()];
    const bancos = await listBancos({ onlyAtivos: true, empresaId: EMPRESA_A });
    assert.equal(calls.length, 1);
    assert.match(calls[0].text, /WHERE b\.empresa_id = \$1 AND b\.ativo = true/);
    assert.deepEqual(calls[0].params, [EMPRESA_A]);
    assert.equal(bancos[0].empresaId, EMPRESA_A);
    assert.equal(bancos[0].empresaNome, 'BAIFER');
  });

  it('listBancos sem empresaId (admin) traz todos, com nome da empresa ou null', async () => {
    nextRows = [row(), row({ id: 'b2', nome: 'MERCADO PAGO', empresa_id: null, empresa_nome: null })];
    const bancos = await listBancos();
    assert.doesNotMatch(calls[0].text, /WHERE/);
    assert.match(calls[0].text, /LEFT JOIN empresas/);
    assert.equal(bancos[1].empresaId, null);
    assert.equal(bancos[1].empresaNome, null);
  });

  it('listBancos com empresaId vazio não vira "todos os bancos"', async () => {
    const bancos = await listBancos({ onlyAtivos: true, empresaId: null });
    assert.deepEqual(bancos, []);
    assert.equal(calls.length, 0);
  });

  it('getFirstActiveBanco só procura na empresa', async () => {
    nextRows = [row()];
    await getFirstActiveBanco({ empresaId: EMPRESA_A });
    assert.match(calls[0].text, /b\.empresa_id = \$1/);
    assert.deepEqual(calls[0].params, [EMPRESA_A]);
    assert.equal(await getFirstActiveBanco({}), null);
  });

  it('createBanco sem empresa recusa sem gravar', async () => {
    await assert.rejects(
      () => createBanco({ nome: 'STONE BAIFER', codigoCredito: 8 }),
      /Escolha a empresa do banco/,
    );
    assert.equal(calls.length, 0);
  });

  it('createBanco grava empresa_id', async () => {
    nextRows = [row({ nome: 'STONE BAIFER', codigo_credito: 8, empresa_nome: undefined })];
    const banco = await createBanco({ nome: 'stone baifer', codigoCredito: '8', empresaId: EMPRESA_A });
    assert.match(calls[0].text, /INSERT INTO bancos \(nome, codigo_credito, ativo, empresa_id\)/);
    assert.deepEqual(calls[0].params, ['STONE BAIFER', 8, EMPRESA_A]);
    assert.equal(banco.empresaId, EMPRESA_A);
  });

  it('updateBanco grava a empresa escolhida; toggle mantém a atual', async () => {
    nextRows = [row({ empresa_id: null, empresa_nome: null })];
    await updateBanco('b1', { nome: 'ITAU BAIFER', codigoCredito: '9', empresaId: EMPRESA_B });
    assert.deepEqual(calls[1].params, ['b1', 'ITAU BAIFER', 9, true, EMPRESA_B]);

    calls.length = 0;
    nextRows = [row()];
    await updateBanco('b1', { ativo: false });
    assert.deepEqual(calls[1].params, ['b1', 'ITAU BAIFER', 9, false, EMPRESA_A]);
  });

  it('updateBanco com empresa vazia recusa', async () => {
    nextRows = [row()];
    await assert.rejects(
      () => updateBanco('b1', { nome: 'ITAU BAIFER', codigoCredito: '9', empresaId: '' }),
      /Escolha a empresa do banco/,
    );
    assert.equal(calls.length, 1);
  });

  it('getBancoDaEmpresa recusa banco de outra empresa, sem empresa ou inativo', async () => {
    nextRows = [row()];
    assert.equal((await getBancoDaEmpresa('b1', EMPRESA_A)).id, 'b1');
    assert.equal(await getBancoDaEmpresa('b1', EMPRESA_B), null);

    nextRows = [row({ empresa_id: null })];
    assert.equal(await getBancoDaEmpresa('b1', EMPRESA_A), null);

    nextRows = [row({ ativo: false })];
    assert.equal(await getBancoDaEmpresa('b1', EMPRESA_A), null);

    nextRows = [];
    assert.equal(await getBancoDaEmpresa('nao-existe', EMPRESA_A), null);
    assert.equal(await getBancoDaEmpresa('b1', null), null);
  });
});

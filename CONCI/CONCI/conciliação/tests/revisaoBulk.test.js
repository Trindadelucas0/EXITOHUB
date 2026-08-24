'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = path.join(os.tmpdir(), `revisao-bulk-test-${process.pid}`);
process.env.PRE_CADASTRO_DIR = tmpDir;

const store = require('../src/services/preCadastroStore');
const {
  excludeItems,
  reapplyPreCadastroItems,
  applyCapLote,
  applyCapAndPre,
  normalizeRowIds,
} = require('../src/services/revisaoBulk');

const SID = 'bulk-test-sid';

function writeSession(storeKey, itens) {
  const fp = path.join(tmpDir, `${storeKey}.json`);
  fs.writeFileSync(fp, JSON.stringify({
    sessionId: storeKey,
    userId: null,
    itens,
  }, null, 2));
}

function baseItens() {
  return [
    {
      rowId: 'a1',
      id: 'a1',
      tipo: 'pagamento',
      status: 'MATCHED',
      classificacaoCap: 'FORNECEDORES',
      categoria: 'FORNECEDORES',
      debito: null,
      credito: null,
      valor: -100,
      historico: 'BOLETO A',
      numeroNota: '',
    },
    {
      rowId: 'b2',
      id: 'b2',
      tipo: 'pagamento',
      status: 'SEM_MATCH',
      classificacaoCap: '',
      categoria: '',
      debito: null,
      credito: null,
      valor: -50,
      historico: 'PIX B',
      numeroNota: '',
    },
    {
      rowId: 'c3',
      id: 'c3',
      tipo: 'recebimento',
      status: 'RECEBIMENTO',
      classificacaoCap: 'RECEBIMENTO',
      categoria: 'RECEBIMENTO',
      debito: null,
      credito: null,
      valor: 200,
      historico: 'PIX RECEBIDO',
      numeroNota: '',
    },
  ];
}

describe('revisaoBulk', () => {
  before(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.PRE_CADASTRO_DIR;
  });

  beforeEach(() => {
    writeSession(SID, []);
  });

  it('normalizeRowIds aceita string unica ou array', () => {
    assert.deepEqual(normalizeRowIds('x'), ['x']);
    assert.deepEqual(normalizeRowIds(['a', 'a', 'b']), ['a', 'b']);
    assert.deepEqual(normalizeRowIds(null), []);
  });

  it('excludeItems remove IDs e atualiza contagem', () => {
    const { itens, removed } = excludeItems(baseItens(), ['a1', 'c3']);
    assert.equal(removed, 2);
    assert.equal(itens.length, 1);
    assert.equal(itens[0].rowId, 'b2');
  });

  it('excludeItems sem IDs nao altera lista', () => {
    const orig = baseItens();
    const { itens, removed } = excludeItems(orig, []);
    assert.equal(removed, 0);
    assert.equal(itens.length, 3);
  });

  it('reaplicar preenche debito/credito quando pre-cadastro existe', () => {
    writeSession(SID, [
      { id: 'p1', descricao: 'FORNECEDORES', debito: 1004, credito: 9 },
      { id: 'p2', descricao: 'RECEBIMENTO DE CLIENTES', debito: 9, credito: 101 },
    ]);

    const { itens, updated } = reapplyPreCadastroItems(baseItens(), SID, []);
    assert.equal(updated, 3);
    assert.equal(itens[0].debito, 1004);
    assert.equal(itens[0].credito, 9);
    assert.ok(itens[0].preCadastroId);
    assert.equal(itens[2].debito, 9);
    assert.equal(itens[2].credito, 101);
  });

  it('reaplicar so nos selecionados', () => {
    writeSession(SID, [
      { id: 'p1', descricao: 'FORNECEDORES', debito: 1004, credito: 9 },
    ]);
    const { itens, updated } = reapplyPreCadastroItems(baseItens(), SID, ['a1']);
    assert.equal(updated, 1);
    assert.equal(itens[0].debito, 1004);
    assert.equal(itens[1].debito, null);
  });

  it('aplicar CAP em lote altera N itens e aplica codigos', () => {
    writeSession(SID, [
      { id: 'p-f', descricao: 'FRETES SOBRE COMPRAS', debito: 2101, credito: 9 },
    ]);
    const { itens, updated, error } = applyCapLote(
      baseItens(),
      ['b2', 'c3'],
      'FRETES SOBRE COMPRAS',
      SID,
    );
    assert.equal(error, null);
    assert.equal(updated, 2);
    assert.equal(itens[1].classificacaoCap, 'FRETES SOBRE COMPRAS');
    assert.equal(itens[1].debito, 2101);
    assert.equal(itens[1].credito, 9);
    assert.equal(itens[2].classificacaoCap, 'FRETES SOBRE COMPRAS');
    assert.equal(itens[2].debito, 2101);
    assert.equal(itens[0].classificacaoCap, 'FORNECEDORES');
  });

  it('applyCapAndPre persiste classificacao manual em item SEM_MATCH (usado pelo Aprovar)', () => {
    // Mesmo helper usado por src/routes/conciliacao.js na acao "aprovar" para
    // evitar que a Classificacao Exito digitada manualmente se perca ao aprovar.
    const semMatch = baseItens()[1];
    assert.equal(semMatch.classificacaoCap, '');

    const result = applyCapAndPre(semMatch, 'FRETES SOBRE COMPRAS', SID);
    assert.equal(result.classificacaoCap, 'FRETES SOBRE COMPRAS');
    assert.equal(result.categoria, 'FRETES SOBRE COMPRAS');
    assert.equal(result.error, null);
  });

  it('aplicar CAP em lote exige selecao e CAP', () => {
    const semSel = applyCapLote(baseItens(), [], 'ENERGIA', SID);
    assert.ok(semSel.error);
    assert.equal(semSel.updated, 0);

    const semCap = applyCapLote(baseItens(), ['a1'], '  ', SID);
    assert.ok(semCap.error);
    assert.equal(semCap.updated, 0);
  });
});

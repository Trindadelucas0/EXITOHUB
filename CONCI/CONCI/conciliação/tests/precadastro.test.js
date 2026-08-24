'use strict';

const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = path.join(os.tmpdir(), `pre-cadastro-test-${process.pid}`);
process.env.PRE_CADASTRO_DIR = tmpDir;
fs.mkdirSync(tmpDir, { recursive: true });

const store = require('../src/services/preCadastroStore');
const { runMatching } = require('../src/services/matching/orchestrator');
const { applyColumnFilters } = require('../src/services/columnFilters');

const SID = 'sess-test-a';

function writeSession(sessionId, itens) {
  const fp = path.join(tmpDir, `${sessionId}.json`);
  fs.writeFileSync(fp, JSON.stringify({
    sessionId,
    userId: null,
    itens,
  }, null, 2));
}

describe('pre-cadastro por sessao', () => {
  beforeEach(() => {
    writeSession(SID, []);
  });

  after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    delete process.env.PRE_CADASTRO_DIR;
  });

  it('toOptionalNumber: vazio e nao numerico viram null', () => {
    assert.equal(store.toOptionalNumber(''), null);
    assert.equal(store.toOptionalNumber('  '), null);
    assert.equal(store.toOptionalNumber(null), null);
    assert.equal(store.toOptionalNumber('abc'), null);
    assert.equal(store.toOptionalNumber('2101'), 2101);
    assert.equal(store.toOptionalNumber(9), 9);
  });

  it('create: so debito preenchido deixa credito null', () => {
    const item = store.create(SID, { descricao: 'SO_DEBITO', debito: 1005, credito: '' });
    assert.equal(item.debito, 1005);
    assert.equal(item.credito, null);
  });

  it('create: so credito preenchido deixa debito null', () => {
    const item = store.create(SID, { descricao: 'SO_CREDITO', debito: 'x', credito: 9 });
    assert.equal(item.debito, null);
    assert.equal(item.credito, 9);
  });

  it('findByDescricao: trim e case-insensitive, sem match parcial', () => {
    writeSession(SID, [{ id: 't1', descricao: 'ENERGIA', debito: 2101, credito: 9 }]);

    assert.equal(store.findByDescricao(SID, 'ENERGIA').debito, 2101);
    assert.equal(store.findByDescricao(SID, ' ENERGIA ').debito, 2101);
    assert.equal(store.findByDescricao(SID, 'energia').debito, 2101);
    assert.equal(store.findByDescricao(SID, 'ENERGI'), null);
  });

  it('isolamento: duas sessoes nao compartilham itens', () => {
    const s1 = 'sess-iso-1';
    const s2 = 'sess-iso-2';
    writeSession(s1, []);
    writeSession(s2, []);

    store.create(s1, { descricao: 'ENERGIA', debito: 2101, credito: 9 });
    store.create(s2, { descricao: 'ENERGIA', debito: 9999, credito: 1 });

    assert.equal(store.findByDescricao(s1, 'ENERGIA').debito, 2101);
    assert.equal(store.findByDescricao(s2, 'ENERGIA').debito, 9999);
    assert.equal(store.list(s1).length, 1);
    assert.equal(store.list(s2).length, 1);
  });

  it('matching aplica debito/credito do pre-cadastro pela Classificacao CAP', () => {
    writeSession(SID, [{ id: 't2', descricao: 'ENERGIA', debito: 2101, credito: 9 }]);

    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-20',
        historico: 'BOLETO PAGO NEOENERGIA',
        razaoSocial: 'NEOENERGIA',
        cnpj: '11111111000111',
        valor: -1343.66,
      }],
      contas: [{
        id: 'c1',
        categoria: 'ENERGIA',
        nome: 'NEOENERGIA',
        cnpj: '11111111000111',
        nrNota: '',
        vencimento: '2026-04-20',
        pagamento: '2026-04-20',
        valor: 1343.66,
      }],
    });

    assert.equal(itens[0].classificacaoCap, 'ENERGIA');
    assert.equal(itens[0].debito, 2101);
    assert.equal(itens[0].credito, 9);
    assert.ok(itens[0].preCadastroId);
  });

  it('matching: so debito no pre-cadastro deixa credito null', () => {
    writeSession(SID, [{ id: 't2b', descricao: 'ENERGIA', debito: 2101, credito: null }]);

    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-20',
        historico: 'BOLETO PAGO NEOENERGIA',
        razaoSocial: 'NEOENERGIA',
        cnpj: '11111111000111',
        valor: -1343.66,
      }],
      contas: [{
        id: 'c1',
        categoria: 'ENERGIA',
        nome: 'NEOENERGIA',
        cnpj: '11111111000111',
        nrNota: '',
        vencimento: '2026-04-20',
        pagamento: '2026-04-20',
        valor: 1343.66,
      }],
    });

    assert.equal(itens[0].debito, 2101);
    assert.equal(itens[0].credito, null);
  });

  it('sem pre-cadastro para CAP: debito e credito null', () => {
    writeSession(SID, [{ id: 't3', descricao: 'ENERGIA', debito: 2101, credito: 9 }]);

    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-01',
        historico: 'BOLETO PAGO X',
        razaoSocial: 'X',
        cnpj: '84431154000128',
        valor: -100,
      }],
      contas: [{
        id: 'c1',
        categoria: 'FORNECEDORES',
        nome: 'X',
        cnpj: '84431154000632',
        nrNota: '',
        vencimento: '2026-04-01',
        pagamento: '2026-04-01',
        valor: 100,
      }],
    });

    assert.equal(itens[0].classificacaoCap, 'FORNECEDORES');
    assert.equal(itens[0].debito, null);
    assert.equal(itens[0].credito, null);
  });

  it('filtro por Classificacao CAP', () => {
    const rows = [
      { classificacaoCap: 'FORNECEDORES', historico: 'A', data: '2026-04-01', debito: 1004, credito: 9, valor: -10, numeroNota: '' },
      { classificacaoCap: 'ENERGIA', historico: 'B', data: '2026-04-02', debito: 2101, credito: 9, valor: -20, numeroNota: '' },
    ];
    const filtered = applyColumnFilters(rows, { fClassificacao: 'ENERGIA' });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].classificacaoCap, 'ENERGIA');
  });

  it('recebimento: Classificacao RECEBIMENTO e codigos de RECEBIMENTO DE CLIENTES', () => {
    writeSession(SID, [{
      id: 't4',
      descricao: store.DESCRICAO_RECEBIMENTO_CLIENTES,
      debito: 9,
      credito: 3001,
    }]);

    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'r1',
        data: '2026-04-01',
        historico: 'PIX QR CODE RECEBIDO',
        razaoSocial: '',
        cnpj: '',
        valor: 150,
      }],
      contas: [],
    });

    assert.equal(itens[0].tipo, 'recebimento');
    assert.equal(itens[0].status, 'RECEBIMENTO');
    assert.equal(itens[0].classificacaoCap, 'RECEBIMENTO');
    assert.equal(itens[0].debito, 9);
    assert.equal(itens[0].credito, 3001);
    assert.ok(itens[0].preCadastroId);
  });

  it('recebimento: pre-cadastro so com RECEBIMENTO aplica codigos', () => {
    writeSession(SID, [{
      id: 't4b',
      descricao: 'RECEBIMENTO',
      debito: 9,
      credito: 4001,
    }]);

    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'r1b',
        data: '2026-04-01',
        historico: 'PIX RECEBIDO',
        razaoSocial: '',
        cnpj: '',
        valor: 80,
      }],
      contas: [],
    });

    assert.equal(itens[0].classificacaoCap, 'RECEBIMENTO');
    assert.equal(itens[0].debito, 9);
    assert.equal(itens[0].credito, 4001);
    assert.ok(itens[0].preCadastroId);
    assert.equal(itens[0].motivo, 'RECEBIMENTO');
  });

  it('recebimento: findByDescricao case-insensitive', () => {
    writeSession(SID, [{
      id: 't4c',
      descricao: 'recebimento de clientes',
      debito: 11,
      credito: 5001,
    }]);

    const found = store.findByDescricao(SID, 'RECEBIMENTO DE CLIENTES');
    assert.ok(found);
    assert.equal(found.debito, 11);

    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'r1c',
        data: '2026-04-02',
        historico: 'TED RECEBIDA',
        razaoSocial: '',
        cnpj: '',
        valor: 99,
      }],
      contas: [],
    });

    assert.equal(itens[0].debito, 11);
    assert.equal(itens[0].credito, 5001);
    assert.ok(itens[0].preCadastroId);
  });

  it('recebimento: CAP manual FRETES SOBRE COMPRAS aplica codigos do pre-cadastro', () => {
    writeSession(SID, [{
      id: 't-frete',
      descricao: 'FRETES SOBRE COMPRAS',
      debito: 1004,
      credito: 9,
    }]);

    const withCap = store.applyPreCadastro({
      tipo: 'recebimento',
      status: 'RECEBIMENTO',
      classificacaoCap: 'FRETES SOBRE COMPRAS',
      categoria: 'FRETES SOBRE COMPRAS',
      historico: 'PIX RECEBIDO',
      valor: 200,
      debito: null,
      credito: null,
    }, SID);

    assert.equal(withCap.classificacaoCap, 'FRETES SOBRE COMPRAS');
    assert.equal(withCap.debito, 1004);
    assert.equal(withCap.credito, 9);
    assert.ok(withCap.preCadastroId);
    assert.equal(withCap.motivo, 'FRETES SOBRE COMPRAS');
  });

  it('JSON da sessao inclui userId null', () => {
    writeSession(SID, []);
    store.create(SID, { descricao: 'X', debito: 1, credito: 2 });
    const doc = store.readSession(SID);
    assert.equal(doc.userId, null);
    assert.equal(doc.sessionId, SID);
  });

  it('storeKeyForEmpresaBanco isola pre-cadastro por banco', () => {
    const empresaId = 'emp-banco-1';
    const itauKey = store.storeKeyForEmpresaBanco(empresaId, 'banco-itau');
    const bbKey = store.storeKeyForEmpresaBanco(empresaId, 'banco-bb');
    assert.equal(itauKey, 'empresa-emp-banco-1-banco-banco-itau');
    assert.equal(bbKey, 'empresa-emp-banco-1-banco-banco-bb');

    store.create(itauKey, { descricao: 'FORNECEDORES', debito: 1004, credito: 9 });
    store.create(bbKey, { descricao: 'FORNECEDORES', debito: 1004, credito: 8 });

    assert.equal(store.findByDescricao(itauKey, 'FORNECEDORES').credito, 9);
    assert.equal(store.findByDescricao(bbKey, 'FORNECEDORES').credito, 8);
  });

  it('matching usa pre-cadastro do banco escolhido (credito distinto)', () => {
    const empresaId = 'emp-match-banco';
    const itauKey = store.storeKeyForEmpresaBanco(empresaId, 'itau');
    const bbKey = store.storeKeyForEmpresaBanco(empresaId, 'bb');
    store.create(itauKey, { descricao: 'ENERGIA', debito: 2101, credito: 9 });
    store.create(bbKey, { descricao: 'ENERGIA', debito: 2101, credito: 8 });

    const lanc = [{
      id: 'p1',
      data: '2026-04-20',
      historico: 'BOLETO PAGO NEOENERGIA',
      razaoSocial: 'NEOENERGIA',
      cnpj: '11111111000111',
      valor: -1343.66,
    }];
    const contas = [{
      id: 'c1',
      categoria: 'ENERGIA',
      nome: 'NEOENERGIA',
      cnpj: '11111111000111',
      nrNota: '',
      vencimento: '2026-04-20',
      pagamento: '2026-04-20',
      valor: 1343.66,
    }];

    const itau = runMatching({ sessionId: itauKey, lancamentos: lanc, contas });
    const bb = runMatching({ sessionId: bbKey, lancamentos: lanc, contas });

    assert.equal(itau.itens[0].credito, 9);
    assert.equal(bb.itens[0].credito, 8);
  });

  it('migrateLegacyEmpresaToBanco copia JSON legado uma vez', () => {
    const empresaId = 'emp-legacy-1';
    const bancoId = 'banco-itau';
    const legacyKey = store.storeKeyForEmpresa(empresaId);
    const bankKey = store.storeKeyForEmpresaBanco(empresaId, bancoId);

    writeSession(legacyKey, [{ id: 'leg1', descricao: 'ENERGIA', debito: 2101, credito: 9 }]);

    assert.equal(store.migrateLegacyEmpresaToBanco(empresaId, bancoId), true);
    assert.equal(store.findByDescricao(bankKey, 'ENERGIA').credito, 9);
    assert.equal(store.list(legacyKey).length, 0);

    // segunda chamada nao sobrescreve (arquivo do banco ja tem itens)
    writeSession(legacyKey, [{ id: 'leg2', descricao: 'OUTRO', debito: 1, credito: 1 }]);
    assert.equal(store.migrateLegacyEmpresaToBanco(empresaId, bancoId), false);
    assert.equal(store.findByDescricao(bankKey, 'ENERGIA').credito, 9);
    assert.equal(store.findByDescricao(bankKey, 'OUTRO'), null);
  });

  it('migrateLegacyEmpresaToBanco: banco vazio herda do legado', () => {
    const empresaId = 'emp-legacy-empty';
    const bancoId = 'banco-itau';
    const legacyKey = store.storeKeyForEmpresa(empresaId);
    const bankKey = store.storeKeyForEmpresaBanco(empresaId, bancoId);

    writeSession(bankKey, []);
    writeSession(legacyKey, [{ id: 'leg1', descricao: 'FORNECEDORES', debito: 1004, credito: 9 }]);

    assert.equal(store.migrateLegacyEmpresaToBanco(empresaId, bancoId), true);
    assert.equal(store.findByDescricao(bankKey, 'FORNECEDORES').credito, 9);
    assert.equal(store.list(legacyKey).length, 0);
  });

  it('readSession de chave inexistente nao cria arquivo', () => {
    const key = 'empresa-naoexiste-banco-x';
    const fp = path.join(tmpDir, `${key}.json`);
    assert.equal(fs.existsSync(fp), false);
    const doc = store.readSession(key);
    assert.deepEqual(doc.itens, []);
    assert.equal(doc.sessionId, key);
    assert.equal(fs.existsSync(fp), false);
  });

  it('resolveStoreKey: empresa+banco, so empresa, nunca session.id', () => {
    const empresaId = 'aaaa-bbbb';
    const bancoId = 'cccc-dddd';
    assert.equal(
      store.resolveStoreKey(empresaId, bancoId),
      store.storeKeyForEmpresaBanco(empresaId, bancoId),
    );
    assert.equal(store.resolveStoreKey(empresaId, null), store.storeKeyForEmpresa(empresaId));
    assert.equal(store.resolveStoreKey(empresaId, ''), store.storeKeyForEmpresa(empresaId));
    assert.equal(store.resolveStoreKey(null, bancoId), null);
    assert.equal(store.resolveStoreKey(undefined, undefined), null);
  });

  it('list/matching usa legado se arquivo do banco estiver vazio', () => {
    const empresaId = 'emp-fallback-1';
    const bancoId = 'itau';
    const legacyKey = store.storeKeyForEmpresa(empresaId);
    const bankKey = store.storeKeyForEmpresaBanco(empresaId, bancoId);
    const bankPath = path.join(tmpDir, `${bankKey}.json`);

    writeSession(legacyKey, [{ id: 'leg1', descricao: 'ENERGIA', debito: 2101, credito: 9 }]);
    assert.equal(fs.existsSync(bankPath), false);
    assert.equal(store.list(bankKey).length, 1);
    assert.equal(store.findByDescricao(bankKey, 'ENERGIA').credito, 9);
    assert.equal(fs.existsSync(bankPath), false);

    const { itens } = runMatching({
      sessionId: bankKey,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-20',
        historico: 'BOLETO PAGO NEOENERGIA',
        razaoSocial: 'NEOENERGIA',
        cnpj: '11111111000111',
        valor: -1343.66,
      }],
      contas: [{
        id: 'c1',
        categoria: 'ENERGIA',
        nome: 'NEOENERGIA',
        cnpj: '11111111000111',
        nrNota: '',
        vencimento: '2026-04-20',
        pagamento: '2026-04-20',
        valor: 1343.66,
      }],
    });
    assert.equal(itens[0].debito, 2101);
    assert.equal(itens[0].credito, 9);
    assert.equal(fs.existsSync(bankPath), false);
  });

  it('list nao herda itens de outro banco', () => {
    const empresaId = 'emp-iso-fb';
    const itauKey = store.storeKeyForEmpresaBanco(empresaId, 'itau');
    const bbKey = store.storeKeyForEmpresaBanco(empresaId, 'bb');
    store.create(itauKey, { descricao: 'FORNECEDORES', debito: 1004, credito: 9 });
    assert.equal(store.list(bbKey).length, 0);
    assert.equal(store.findByDescricao(bbKey, 'FORNECEDORES'), null);
  });
});

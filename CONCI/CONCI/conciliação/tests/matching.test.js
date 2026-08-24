'use strict';

const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = path.join(os.tmpdir(), `matching-precad-${process.pid}`);
process.env.PRE_CADASTRO_DIR = tmpDir;
fs.mkdirSync(tmpDir, { recursive: true });

const { runMatching } = require('../src/services/matching/orchestrator');
const { applyRegrasHistorico } = require('../src/services/matching/pass3');
const store = require('../src/services/preCadastroStore');

const SID = 'sess-match';

function writeSession(itens) {
  fs.writeFileSync(path.join(tmpDir, `${SID}.json`), JSON.stringify({
    sessionId: SID,
    userId: null,
    itens,
  }, null, 2));
}

describe('matching unitario', () => {
  beforeEach(() => {
    writeSession([]);
  });

  after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    delete process.env.PRE_CADASTRO_DIR;
  });

  it('regra TAR marca REGRA sem codigo (codigo so via pre-cadastro)', () => {
    const item = applyRegrasHistorico({
      id: 'x',
      data: '2026-04-01',
      historico: 'TAR/CUSTAS COBRANCA',
      razaoSocial: '',
      cnpj: '',
      valor: -1.89,
    });
    assert.ok(item);
    assert.equal(item.status, 'REGRA');
    assert.equal(item.debito, null);
    assert.equal(item.credito, null);
    assert.equal(item.classificacaoCap, 'TARIFAS BANCARIAS');
  });

  it('match por valor+nome no historico preenche classificacao', () => {
    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-10',
        historico: 'BOLETO PAGO SKYTEF',
        razaoSocial: '',
        cnpj: '',
        valor: -150,
      }],
      contas: [{
        id: 'c1',
        categoria: 'LOCACAO DE SOFTWARE',
        nome: 'SKYTEF SOLUCOES EM CAPTURA DE TRANSACOES LTDA',
        cnpj: '04988631000111',
        nrNota: '',
        vencimento: '2026-06-01',
        pagamento: '2026-06-01',
        valor: 150,
      }],
    });
    assert.equal(itens[0].status, 'SUGERIDO');
    assert.equal(itens[0].motivo, 'valor+nome');
    assert.equal(itens[0].classificacaoCap, 'LOCACAO DE SOFTWARE');
  });

  it('match CAP sem pre-cadastro: classificacao preenchida, debito/credito null', () => {
    const { itens, resumo } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-01',
        historico: 'BOLETO PAGO MENEGOTTI MA',
        razaoSocial: 'MENEGOTTI',
        cnpj: '84431154000128',
        valor: -1648.58,
      }],
      contas: [{
        id: 'c1',
        categoria: 'FORNECEDORES',
        nome: 'MENEGOTTI INDUSTRIAS',
        cnpj: '84431154000632',
        nrNota: '481996',
        vencimento: '2026-04-01',
        pagamento: '2026-04-01',
        valor: 1648.58,
      }],
    });
    assert.equal(resumo.total, 1);
    assert.equal(itens[0].status, 'MATCHED');
    assert.equal(itens[0].classificacaoCap, 'FORNECEDORES');
    assert.equal(itens[0].debito, null);
    assert.equal(itens[0].credito, null);
    assert.equal(itens[0].numeroNota, '481996');
  });

  it('match CAP com pre-cadastro aplica debito/credito', () => {
    writeSession([{ id: 'f1', descricao: 'FORNECEDORES', debito: 1004, credito: 9 }]);
    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-01',
        historico: 'BOLETO PAGO MENEGOTTI MA',
        razaoSocial: 'MENEGOTTI',
        cnpj: '84431154000128',
        valor: -1648.58,
      }],
      contas: [{
        id: 'c1',
        categoria: 'FORNECEDORES',
        nome: 'MENEGOTTI INDUSTRIAS',
        cnpj: '84431154000632',
        nrNota: '481996',
        vencimento: '2026-04-01',
        pagamento: '2026-04-01',
        valor: 1648.58,
      }],
    });
    assert.equal(itens[0].debito, 1004);
    assert.equal(itens[0].credito, 9);
    assert.ok(itens[0].preCadastroId);
  });

  it('sem match deixa classificacao e debito em branco', () => {
    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p2',
        data: '2026-04-01',
        historico: 'PIX ENVIADO ALGUEM',
        razaoSocial: '',
        cnpj: '',
        valor: -50,
      }],
      contas: [],
    });
    assert.equal(itens[0].status, 'SEM_MATCH');
    assert.equal(itens[0].classificacaoCap, '');
    assert.equal(itens[0].debito, null);
    assert.equal(itens[0].credito, null);
  });

  it('duas contas mesmo valor+data: historico escolhe CAP correta (nao a primeira por data)', () => {
    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-10',
        historico: 'BOLETO PAGO SKYTEF',
        razaoSocial: '',
        cnpj: '',
        valor: -150,
      }],
      contas: [
        {
          id: 'c1',
          categoria: 'FORNECEDORES',
          nome: 'OUTRA EMPRESA LTDA',
          cnpj: '11111111000111',
          nrNota: '',
          vencimento: '2026-04-10',
          pagamento: '2026-04-10',
          valor: 150,
        },
        {
          id: 'c2',
          categoria: 'LOCACAO DE SOFTWARE',
          nome: 'SKYTEF SOLUCOES EM CAPTURA DE TRANSACOES LTDA',
          cnpj: '04988631000111',
          nrNota: '',
          vencimento: '2026-04-10',
          pagamento: '2026-04-10',
          valor: 150,
        },
      ],
    });
    assert.equal(itens[0].status, 'SUGERIDO');
    assert.equal(itens[0].motivo, 'valor+nome');
    assert.equal(itens[0].classificacaoCap, 'LOCACAO DE SOFTWARE');
    assert.equal(itens[0].contaPagarId, 'c2');
  });

  it('valor+data so casa quando ha candidata unica sem nome no historico', () => {
    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-10',
        historico: 'PAGAMENTO DIVERSO',
        razaoSocial: '',
        cnpj: '',
        valor: -200,
      }],
      contas: [{
        id: 'c1',
        categoria: 'ENERGIA',
        nome: 'NEOENERGIA PERNAMBUCO',
        cnpj: '22222222000122',
        nrNota: '',
        vencimento: '2026-04-10',
        pagamento: '2026-04-10',
        valor: 200,
      }],
    });
    assert.equal(itens[0].status, 'SUGERIDO');
    assert.equal(itens[0].motivo, 'valor+data');
    assert.equal(itens[0].classificacaoCap, 'ENERGIA');
  });

  it('PIX ENVIADO nao casa valor_unico com Contas a Pagar', () => {
    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-10',
        historico: 'PIX ENVIADO',
        razaoSocial: '',
        cnpj: '',
        valor: -1016,
      }],
      contas: [{
        id: 'c1',
        categoria: 'FORNECEDORES',
        nome: 'ALGUEM LTDA',
        cnpj: '11111111000111',
        nrNota: '415',
        vencimento: '2026-04-10',
        pagamento: '2026-04-10',
        valor: 1016,
      }],
    });
    assert.equal(itens[0].status, 'SEM_MATCH');
    assert.equal(itens[0].classificacaoCap, '');
  });

  it('PIX ENVIADO sem data em comum fica SEM_MATCH (nao valor_unico)', () => {
    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-10',
        historico: 'PIX ENVIADO',
        razaoSocial: '',
        cnpj: '',
        valor: -1016,
      }],
      contas: [{
        id: 'c1',
        categoria: 'FORNECEDORES',
        nome: 'ALGUEM LTDA',
        cnpj: '11111111000111',
        nrNota: '415',
        vencimento: '2026-05-01',
        pagamento: '2026-05-01',
        valor: 1016,
      }],
    });
    assert.equal(itens[0].status, 'SEM_MATCH');
    assert.equal(itens[0].classificacaoCap, '');
    assert.equal(itens[0].numeroNota, '');
  });

  it('inclui recebimentos no extrato completo', () => {
    const { itens, resumo } = runMatching({
      sessionId: SID,
      lancamentos: [
        {
          id: 'p1',
          data: '2026-04-01',
          historico: 'TAR/CUSTAS COBRANCA',
          razaoSocial: '',
          cnpj: '',
          valor: -1.89,
        },
        {
          id: 'r1',
          data: '2026-04-01',
          historico: 'PIX QR CODE RECEBIDO',
          razaoSocial: '',
          cnpj: '',
          valor: 100,
        },
      ],
      contas: [],
    });
    assert.equal(resumo.total, 2);
    assert.equal(resumo.pagamentos, 1);
    assert.equal(resumo.recebimentos, 1);
    assert.equal(itens[1].tipo, 'recebimento');
    assert.equal(itens[1].status, 'RECEBIMENTO');
    assert.equal(itens[1].classificacaoCap, 'RECEBIMENTO');
    assert.equal(itens[1].debito, null);
    assert.equal(itens[0].status, 'REGRA');
    assert.equal(itens[0].debito, null);
  });

  it('TAR com pre-cadastro TARIFAS BANCARIAS aplica codigos', () => {
    writeSession([{
      id: 't1',
      descricao: store.DESCRICAO_TARIFAS_BANCARIAS,
      debito: 1025,
      credito: 9,
    }]);
    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-01',
        historico: 'TAR/CUSTAS COBRANCA',
        razaoSocial: '',
        cnpj: '',
        valor: -1.89,
      }],
      contas: [],
    });
    assert.equal(itens[0].status, 'REGRA');
    assert.equal(itens[0].debito, 1025);
    assert.equal(itens[0].credito, 9);
    assert.equal(itens[0].classificacaoCap, 'TARIFAS BANCARIAS');
  });

  it('matching com so credito no pre-cadastro deixa debito null', () => {
    writeSession([{ id: 'f2', descricao: 'FORNECEDORES', debito: null, credito: 9 }]);
    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-01',
        historico: 'BOLETO PAGO MENEGOTTI MA',
        razaoSocial: 'MENEGOTTI',
        cnpj: '84431154000128',
        valor: -1648.58,
      }],
      contas: [{
        id: 'c1',
        categoria: 'FORNECEDORES',
        nome: 'MENEGOTTI INDUSTRIAS',
        cnpj: '84431154000632',
        nrNota: '481996',
        vencimento: '2026-04-01',
        pagamento: '2026-04-01',
        valor: 1648.58,
      }],
    });
    assert.equal(itens[0].debito, null);
    assert.equal(itens[0].credito, 9);
  });

  it('todo valor positivo fica RECEBIMENTO com Classificacao CAP', () => {
    writeSession([]);
    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [
        {
          id: 'r1',
          data: '2026-04-01',
          historico: 'PIX QR CODE RECEBIDO',
          razaoSocial: '',
          cnpj: '',
          valor: 100,
        },
        {
          id: 'r2',
          data: '2026-04-01',
          historico: 'RES APLIC AUT MAIS',
          razaoSocial: '',
          cnpj: '',
          valor: 555,
        },
        {
          id: 'p1',
          data: '2026-04-01',
          historico: 'PIX ENVIADO',
          razaoSocial: '',
          cnpj: '',
          valor: -50,
        },
      ],
      contas: [],
    });

    const positivos = itens.filter((i) => i.valor > 0);
    assert.equal(positivos.length, 2);
    for (const item of positivos) {
      assert.equal(item.tipo, 'recebimento');
      assert.equal(item.status, 'RECEBIMENTO');
      assert.equal(item.classificacaoCap, 'RECEBIMENTO');
    }
    assert.equal(itens.find((i) => i.valor < 0).tipo, 'pagamento');
  });

  it('Nº nota vem do nrNota da Contas a Pagar no match', () => {
    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-01',
        historico: 'BOLETO PAGO MENEGOTTI MA',
        razaoSocial: 'MENEGOTTI',
        cnpj: '84431154000128',
        valor: -1648.58,
      }],
      contas: [{
        id: 'c1',
        categoria: 'FORNECEDORES',
        nome: 'MENEGOTTI INDUSTRIAS',
        cnpj: '84431154000632',
        nrNota: '481996',
        vencimento: '2026-04-01',
        pagamento: '2026-04-01',
        valor: 1648.58,
      }],
    });
    assert.equal(itens[0].numeroNota, '481996');
    assert.equal(itens[0].classificacaoCap, 'FORNECEDORES');
  });

  it('residual: historico casa com descricao do pre-cadastro e preenche CAP+codigos', () => {
    writeSession([{ id: 'apl1', descricao: 'APL APLIC', debito: 1101, credito: 9 }]);

    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-01',
        historico: 'APL APLIC AUT MAIS',
        razaoSocial: '',
        cnpj: '',
        valor: -200,
      }],
      contas: [],
    });

    assert.equal(itens[0].status, 'SUGERIDO');
    assert.equal(itens[0].motivo, 'historico+precadastro');
    assert.equal(itens[0].classificacaoCap, 'APL APLIC');
    assert.equal(itens[0].debito, 1101);
    assert.equal(itens[0].credito, 9);
    assert.ok(itens[0].preCadastroId);
    assert.equal(itens[0].aprovado, true);
  });

  it('residual: igualdade exata historico = descricao classifica', () => {
    writeSession([{ id: 'ex1', descricao: 'PIX ENVIADO FORNECEDOR X', debito: 1004, credito: 9 }]);

    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-01',
        historico: 'PIX ENVIADO FORNECEDOR X',
        razaoSocial: '',
        cnpj: '',
        valor: -80,
      }],
      contas: [],
    });

    assert.equal(itens[0].classificacaoCap, 'PIX ENVIADO FORNECEDOR X');
    assert.equal(itens[0].motivo, 'historico+precadastro');
    assert.equal(itens[0].debito, 1004);
  });

  it('CAP da Contas a Pagar nao e sobrescrita pelo historico', () => {
    writeSession([
      { id: 't1', descricao: 'FORNECEDORES', debito: 1004, credito: 9 },
      { id: 't2', descricao: 'BOLETO PAGO', debito: 9999, credito: 1 },
    ]);

    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-01',
        historico: 'BOLETO PAGO MENEGOTTI MA',
        razaoSocial: 'MENEGOTTI',
        cnpj: '84431154000128',
        valor: -100,
      }],
      contas: [{
        id: 'c1',
        categoria: 'FORNECEDORES',
        nome: 'MENEGOTTI INDUSTRIAS',
        cnpj: '84431154000632',
        nrNota: '',
        vencimento: '2026-04-01',
        pagamento: '2026-04-01',
        valor: 100,
      }],
    });

    assert.equal(itens[0].classificacaoCap, 'FORNECEDORES');
    assert.notEqual(itens[0].motivo, 'historico+precadastro');
    assert.equal(itens[0].debito, 1004);
    assert.equal(itens[0].credito, 9);
  });

  it('ENERGIA no pre-cadastro nao classifica NEOENERGIA sem Contas a Pagar', () => {
    writeSession([{ id: 't1', descricao: 'ENERGIA', debito: 2101, credito: 9 }]);

    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-01',
        historico: 'BOLETO PAGO NEOENERGIA',
        razaoSocial: '',
        cnpj: '',
        valor: -50,
      }],
      contas: [],
    });

    assert.equal(itens[0].status, 'SEM_MATCH');
    assert.equal(itens[0].classificacaoCap, '');
    assert.equal(itens[0].debito, null);
    assert.equal(itens[0].credito, null);
  });

  it('RECEBIMENTO DE CLIENTES no pre-cadastro nao classifica pagamento residual', () => {
    writeSession([{
      id: 'r1',
      descricao: 'RECEBIMENTO DE CLIENTES',
      debito: 9,
      credito: 1001,
    }]);

    const { itens } = runMatching({
      sessionId: SID,
      lancamentos: [{
        id: 'p1',
        data: '2026-04-01',
        historico: 'RECEBIMENTO DE CLIENTES AVULSO',
        razaoSocial: '',
        cnpj: '',
        valor: -10,
      }],
      contas: [],
    });

    assert.equal(itens[0].status, 'SEM_MATCH');
    assert.equal(itens[0].classificacaoCap, '');
    assert.equal(itens[0].debito, null);
  });
});

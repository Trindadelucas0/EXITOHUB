'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = path.join(os.tmpdir(), `agosto-baifer-precad-${process.pid}`);
process.env.PRE_CADASTRO_DIR = tmpDir;
fs.mkdirSync(tmpDir, { recursive: true });

const { parseExtrato } = require('../src/services/parsers/extrato');
const { parseContasPagar } = require('../src/services/parsers/contasPagar');
const { runMatching } = require('../src/services/matching/orchestrator');
const { readSession, create } = require('../src/services/preCadastroStore');

const SID = 'sess-agosto-baifer';
const calibracaoDir = path.join(__dirname, '..', 'fixtures', 'calibracao');
const EXTRATO_PATH = path.join(calibracaoDir, 'extrato-itau-baifer-08-2026.xlsx');
const CONTAS_PATH = path.join(calibracaoDir, 'contas-pagar-baifer-08-2026.ods');

async function loadAgosto() {
  const extrato = parseExtrato(EXTRATO_PATH);
  const contas = await parseContasPagar(CONTAS_PATH, path.basename(CONTAS_PATH));
  return { extrato, contas };
}

function match(extrato, contas) {
  return runMatching({ sessionId: SID, lancamentos: extrato.lancamentos, contas });
}

function fingerprint(result) {
  return result.itens.map((i) => [
    i.historico,
    i.valor,
    i.status,
    i.debito,
    i.numeroNota,
    i.classificacaoCap,
    i.passagem,
    i.motivo,
  ]);
}

describe('calibracao Baifer Itau 08-2026', () => {
  let extrato;
  let contas;
  let result;

  before(async () => {
    readSession(SID);
    const explicitos = [
      { descricao: 'FORNECEDORES', debito: 1004, credito: 9 },
      { descricao: 'FRETES SOBRE COMPRAS', debito: 1004, credito: 9 },
      { descricao: 'ENERGIA', debito: 1005, credito: 9 },
      {
        descricao: 'TARIFAS BANCARIAS',
        debito: 1025,
        credito: 9,
        historicos: ['TAR/CUSTAS', 'TARIFA'],
      },
      { descricao: 'RECEBIMENTO DE CLIENTES', debito: 9, credito: 101 },
    ];
    for (const item of explicitos) {
      try {
        create(SID, item);
      } catch {
        // ja existe
      }
    }
    ({ extrato, contas } = await loadAgosto());
    result = match(extrato, contas);
  });

  after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    delete process.env.PRE_CADASTRO_DIR;
  });

  it('parser le agosto/2026 com as contagens calibradas', () => {
    assert.equal(extrato.lancamentos.length, 502);
    assert.equal(extrato.pagamentos.length, 319);
    assert.equal(extrato.recebimentos.length, 183);
    for (const l of extrato.lancamentos) {
      assert.ok(l.data >= '2026-08-01' && l.data <= '2026-08-31', `data fora de agosto: ${l.data}`);
    }

    assert.equal(contas.length, 294);
    assert.equal(contas.filter((c) => c.categoria === 'FORNECEDORES').length, 273);
  });

  it('resumo calibrado e taxa util >= 80% (barra da Rodada A)', () => {
    const { resumo } = result;
    console.log('resumo agosto Baifer Itau', resumo);

    assert.equal(result.itens.length, 502);
    assert.equal(resumo.pagamentos, 319);
    assert.equal(resumo.recebimentos, 183);
    assert.equal(resumo.matched, 258);
    assert.equal(resumo.sugerido, 31);
    assert.equal(resumo.regra, 0);
    assert.equal(resumo.semMatch, 30);
    assert.equal(
      resumo.matched + resumo.sugerido + resumo.regra + resumo.semMatch + resumo.recebimentos,
      resumo.total,
    );

    const util = resumo.matched + resumo.sugerido + resumo.regra;
    assert.ok(util / resumo.pagamentos >= 0.8, `util ${util}/${resumo.pagamentos} < 80%`);
  });

  it('boleto MAKITA de 31/08 casa com a conta FORNECEDORES', () => {
    const makita = result.itens.find(
      (i) => i.data === '2026-08-31' && i.valor === -5876.8 && i.historico.includes('MAKITA BR FER ELETRICAS'),
    );
    assert.ok(makita);
    assert.equal(makita.status, 'MATCHED');
    assert.equal(makita.debito, 1004);
    assert.equal(makita.classificacaoCap, 'FORNECEDORES');
    assert.equal(makita.numeroNota, '75911');
  });

  it('TAR/CUSTAS vira TARIFAS BANCARIAS pelo historico do pre-cadastro, debito 1025', () => {
    const tarifas = result.itens.filter((i) => i.historico.startsWith('TAR/CUSTAS'));
    assert.ok(tarifas.length > 0);
    for (const tarifa of tarifas) {
      assert.equal(tarifa.status, 'SUGERIDO');
      assert.equal(tarifa.motivo, 'historico+precadastro');
      assert.equal(tarifa.debito, 1025);
      assert.equal(tarifa.numeroNota, '');
      assert.equal(tarifa.classificacaoCap, 'TARIFAS BANCARIAS');
      assert.equal(tarifa.aprovado, true);
    }
  });

  it('TAR PIX sem esse texto nos historicos fica sem classificacao', () => {
    const tarPix = result.itens.filter((i) => i.historico.startsWith('TAR PIX'));
    assert.equal(tarPix.length, 2);
    for (const item of tarPix) {
      assert.equal(item.status, 'SEM_MATCH');
      assert.equal(item.classificacaoCap, '');
    }
  });

  it('SISPAG SALARIOS continua sem match e conta ja usada nao casa de novo', () => {
    const salario = result.itens.find(
      (i) => i.data === '2026-08-06' && i.valor === -3868.26 && i.historico === 'SISPAG SALARIOS',
    );
    assert.ok(salario);
    assert.equal(salario.status, 'SEM_MATCH');
    assert.equal(salario.debito, null);
    assert.equal(salario.classificacaoCap, '');

    const ovd = result.itens.filter((i) => i.valor === -1181.35 && i.historico.includes('O V D IMP E'));
    assert.equal(ovd.length, 2);
    assert.equal(ovd.find((i) => i.data === '2026-08-04').status, 'MATCHED');
    assert.equal(ovd.find((i) => i.data === '2026-08-18').status, 'SEM_MATCH');
  });

  it('determinismo: mesma entrada, mesmo resultado', () => {
    const again = match(extrato, contas);
    assert.deepEqual(fingerprint(again), fingerprint(result));
    assert.deepEqual(again.resumo, result.resumo);
  });
});

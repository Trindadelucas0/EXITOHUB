'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = path.join(os.tmpdir(), `pipeline3x-precad-${process.pid}`);
process.env.PRE_CADASTRO_DIR = tmpDir;
fs.mkdirSync(tmpDir, { recursive: true });

const { parseExtrato } = require('../src/services/parsers/extrato');
const { parseContasPagar } = require('../src/services/parsers/contasPagar');
const { runMatching } = require('../src/services/matching/orchestrator');
const { exportDominio, historicoComNota } = require('../src/services/exportDominio');
const { readSession, create } = require('../src/services/preCadastroStore');

const SID = 'sess-pipeline3x';
const fixturesDir = path.join(__dirname, '..', 'fixtures');
const calibracaoDir = path.join(fixturesDir, 'calibracao');

function fixture(matcher) {
  const dirs = [fixturesDir, calibracaoDir].filter((d) => fs.existsSync(d));
  for (const dir of dirs) {
    const name = fs.readdirSync(dir).find(matcher);
    if (name) return path.join(dir, name);
  }
  assert.ok(false, 'fixture ausente');
}

async function loadFixtureData() {
  const extratoPath = fixture((f) => /itau/i.test(f) && /\.xlsx$/i.test(f));
  const contasPath = fixture((f) => /contas-pagar-baifer/i.test(f) && f.toLowerCase().endsWith('.ods'));

  const extrato = parseExtrato(extratoPath);
  const contas = await parseContasPagar(contasPath, path.basename(contasPath));
  return { extrato, contas };
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

function matchOpts(extrato, contas) {
  return {
    sessionId: SID,
    lancamentos: extrato.lancamentos,
    contas,
  };
}

describe('pipeline3x — tres rodadas de confirmacao', () => {
  before(() => {
    // Pre-cadastro so o que o teste cadastra explicitamente (nunca seed automatico)
    readSession(SID);
    const explicitos = [
      { descricao: 'FORNECEDORES', debito: 1004, credito: 9 },
      { descricao: 'FRETES SOBRE COMPRAS', debito: 1004, credito: 9 },
      { descricao: 'ENERGIA', debito: 1005, credito: 9 },
      { descricao: 'TARIFAS BANCARIAS', debito: 1025, credito: 9 },
      { descricao: 'RECEBIMENTO DE CLIENTES', debito: 9, credito: 101 },
    ];
    for (const item of explicitos) {
      try {
        create(SID, item);
      } catch {
        // ja existe
      }
    }
  });

  after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    delete process.env.PRE_CADASTRO_DIR;
  });

  it('Rodada A: extrato completo, cobertura e classificacaoCap string', async () => {
    const { extrato, contas } = await loadFixtureData();
    const result = runMatching(matchOpts(extrato, contas));

    assert.equal(
      result.itens.length,
      extrato.pagamentos.length + extrato.recebimentos.length,
    );
    assert.equal(result.resumo.pagamentos, extrato.pagamentos.length);
    assert.equal(result.resumo.recebimentos, extrato.recebimentos.length);

    assert.equal(
      result.resumo.matched
        + result.resumo.sugerido
        + result.resumo.regra
        + result.resumo.semMatch
        + result.resumo.recebimentos,
      result.resumo.total,
    );

    for (const item of result.itens) {
      assert.equal(typeof item.numeroNota, 'string');
      assert.equal(typeof item.classificacaoCap, 'string');
      assert.ok(item.status, 'status obrigatorio');
    }

    const pagamentos = result.itens.filter((i) => i.tipo === 'pagamento');
    const util = result.resumo.matched + result.resumo.sugerido + result.resumo.regra;
    assert.ok(util / pagamentos.length >= 0.8, `util ${util}/${pagamentos.length} < 80%`);
  });

  it('Rodada B: determinismo — mesma entrada, mesmo resultado', async () => {
    const { extrato, contas } = await loadFixtureData();
    const a = runMatching(matchOpts(extrato, contas));
    const b = runMatching(matchOpts(extrato, contas));
    assert.deepEqual(fingerprint(a), fingerprint(b));
    assert.deepEqual(a.resumo, b.resumo);
  });

  it('Rodada C: regressao CAP, SEM_MATCH em branco + export', async () => {
    const { extrato, contas } = await loadFixtureData();
    const result = runMatching(matchOpts(extrato, contas));

    const menegotti = result.itens.find(
      (i) => i.historico.includes('MENEGOTTI') && i.valor === -1648.58,
    );
    assert.ok(menegotti);
    assert.equal(menegotti.status, 'MATCHED');
    assert.equal(menegotti.debito, 1004);
    assert.equal(menegotti.classificacaoCap, 'FORNECEDORES');

    const tarifa = result.itens.find((i) => i.historico.startsWith('TAR/CUSTAS'));
    assert.ok(tarifa);
    assert.equal(tarifa.status, 'REGRA');
    assert.equal(tarifa.debito, 1025);
    assert.equal(tarifa.numeroNota, '');
    assert.equal(tarifa.classificacaoCap, 'TARIFAS BANCARIAS');

    const semMatch = result.itens.find((i) => i.status === 'SEM_MATCH');
    assert.ok(semMatch);
    assert.equal(semMatch.classificacaoCap, '');
    assert.equal(semMatch.debito, null);

    const recebimento = result.itens.find((i) => i.tipo === 'recebimento');
    assert.ok(recebimento);
    assert.equal(recebimento.status, 'RECEBIMENTO');
    assert.equal(recebimento.classificacaoCap, 'RECEBIMENTO');
    assert.ok(recebimento.valor > 0);

    const aprovados = result.itens.filter(
      (i) => i.aprovado && (i.debito != null || i.credito != null),
    );
    assert.ok(aprovados.length > 0);

    const buffer = await exportDominio(aprovados);
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 1000);

    const hist = historicoComNota({ historico: 'BOLETO X', numeroNota: '123' });
    assert.equal(hist, 'BOLETO X | NF 123');
    assert.equal(historicoComNota({ historico: 'BOLETO X', numeroNota: '' }), 'BOLETO X');
  });
});

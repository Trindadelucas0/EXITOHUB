'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');

const snapshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conci-snap-'));
process.env.CONCI_SNAPSHOT_DIR = snapshotDir;

const {
  parseCompetencia,
  formatCompetencia,
  create,
  getById,
  listByEmpresa,
  update,
  removeById,
  marcarEnviado,
  desbloquear,
  escolherEmpresaParaSnapshot,
  reloadSnapshots,
} = require('../src/services/conciliacaoStore');

after(() => {
  fs.rmSync(snapshotDir, { recursive: true, force: true });
});

describe('escolherEmpresaParaSnapshot', () => {
  const snap = { empresa_id: 'id-velho', empresa_nome: 'Baifer Ltda' };

  it('usa o mesmo id quando a empresa ainda existe', () => {
    const r = escolherEmpresaParaSnapshot(snap, [
      { id: 'id-velho', nome: 'Outro nome', ativo: true },
      { id: 'id-novo', nome: 'Baifer Ltda', ativo: true },
    ]);
    assert.deepEqual(r, { empresaId: 'id-velho', motivo: 'mesmo-id' });
  });

  it('id sumiu: usa a única empresa ativa com o mesmo nome (espaço e caixa não importam)', () => {
    const r = escolherEmpresaParaSnapshot(snap, [
      { id: 'id-novo', nome: '  BAIFER   ltda ', ativo: true },
      { id: 'id-inativo', nome: 'Baifer Ltda', ativo: false },
    ]);
    assert.deepEqual(r, { empresaId: 'id-novo', motivo: 'mesmo-nome' });
  });

  it('dois nomes iguais ativos: não escolhe', () => {
    const r = escolherEmpresaParaSnapshot(snap, [
      { id: 'a', nome: 'Baifer Ltda', ativo: true },
      { id: 'b', nome: 'Baifer Ltda', ativo: true },
    ]);
    assert.deepEqual(r, { empresaId: null, motivo: 'nome-ambiguo' });
  });

  it('nenhum nome igual: não escolhe', () => {
    const r = escolherEmpresaParaSnapshot(snap, [{ id: 'x', nome: 'Egaplast', ativo: true }]);
    assert.deepEqual(r, { empresaId: null, motivo: 'nome-nao-encontrado' });
  });

  it('cópia sem nome de empresa: não escolhe', () => {
    const r = escolherEmpresaParaSnapshot({ empresa_id: 'z' }, [{ id: 'x', nome: 'Egaplast' }]);
    assert.deepEqual(r, { empresaId: null, motivo: 'sem-nome' });
  });
});

describe('parseCompetencia / formatCompetencia', () => {
  it('aceita YYYY-MM do input type=month', () => {
    assert.equal(parseCompetencia('2026-04'), '2026-04');
    assert.equal(parseCompetencia('2026-4'), '2026-04');
  });

  it('aceita MM/AAAA', () => {
    assert.equal(parseCompetencia('04/2026'), '2026-04');
    assert.equal(parseCompetencia('4/2026'), '2026-04');
  });

  it('rejeita invalido', () => {
    assert.equal(parseCompetencia(''), null);
    assert.equal(parseCompetencia('13/2026'), null);
    assert.equal(parseCompetencia('2026'), null);
    assert.equal(parseCompetencia('abc'), null);
  });

  it('formata para exibicao', () => {
    assert.equal(formatCompetencia('2026-04'), '04/2026');
  });
});

describe('conciliacaoStore smoke (Postgres)', () => {
  let skipped = false;
  let empresaId = null;
  let concId = null;

  it('create / get / list / update se DB disponivel', async () => {
    let pool;
    try {
      require('dotenv').config();
      const { getPool, closePool } = require('../src/db/pool');
      pool = getPool();
      await pool.query('SELECT 1');
    } catch (err) {
      skipped = true;
      console.log('[skip] Postgres indisponivel:', err.message);
      return;
    }

    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS empresas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nome TEXT NOT NULL,
          ativo BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS bancos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nome TEXT NOT NULL UNIQUE,
          codigo_credito INT NOT NULL,
          ativo BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS conciliacoes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
          banco_id UUID NULL,
          banco_nome TEXT,
          codigo_credito INT,
          competencia CHAR(7) NOT NULL,
          arquivos JSONB NOT NULL DEFAULT '{}'::jsonb,
          resumo JSONB NOT NULL DEFAULT '{}'::jsonb,
          itens JSONB NOT NULL DEFAULT '[]'::jsonb,
          used_gemini BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE conciliacoes ADD COLUMN IF NOT EXISTS enviado BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE conciliacoes ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMPTZ NULL;
        ALTER TABLE conciliacoes ADD COLUMN IF NOT EXISTS motivos_edicao JSONB NOT NULL DEFAULT '[]'::jsonb;
      `);

      const emp = await pool.query(
        `INSERT INTO empresas (nome) VALUES ('teste-conciliacao-store') RETURNING id`,
      );
      empresaId = emp.rows[0].id;
      concId = randomUUID();

      const created = await create({
        id: concId,
        empresaId,
        bancoId: null,
        bancoNome: 'ITAU',
        codigoCredito: 9,
        competencia: '2026-04',
        arquivos: { extrato: 'e.xlsx', contasPagar: 'c.ods' },
        resumo: { total: 2, aprovados: 0 },
        itens: [{ rowId: 'r1', historico: 'TEST', valor: -10 }],
        usedGemini: false,
      });
      assert.equal(created.id, concId);
      assert.equal(created.competencia, '2026-04');

      const snapFile = path.join(snapshotDir, `${concId}.json`);
      const snap = JSON.parse(fs.readFileSync(snapFile, 'utf8'));
      assert.equal(snap.empresa_nome, 'teste-conciliacao-store');
      assert.equal(snap.itens.length, 1);

      // VPS voltou sem a linha: o boot repõe a partir da cópia em disco.
      await pool.query('DELETE FROM conciliacoes WHERE id = $1', [concId]);
      assert.equal(await getById(concId, empresaId), null);
      const reload = await reloadSnapshots();
      assert.ok(reload.repostas >= 1);
      const reposta = await getById(concId, empresaId);
      assert.ok(reposta);
      assert.equal(reposta.competencia, '2026-04');
      assert.equal(reposta.itens.length, 1);

      const got = await getById(concId, empresaId);
      assert.ok(got);
      assert.equal(got.itens.length, 1);

      const lista = await listByEmpresa(empresaId, { competencia: '04/2026' });
      assert.ok(lista.some((r) => r.id === concId));

      const updated = await update(concId, {
        itens: [{ rowId: 'r1', historico: 'TEST', valor: -10, aprovado: true }],
        resumo: { total: 2, aprovados: 1 },
      });
      assert.equal(updated.resumo.aprovados, 1);
      assert.equal(JSON.parse(fs.readFileSync(snapFile, 'utf8')).resumo.aprovados, 1);

      const enviado = await marcarEnviado(concId, empresaId);
      assert.equal(enviado.enviado, true);
      assert.ok(enviado.enviadoEm);

      // Enquanto enviado, exclusao deve ser recusada (defesa em profundidade no store).
      const bloqueado = await removeById(concId, empresaId);
      assert.equal(bloqueado, false);
      assert.ok(await getById(concId, empresaId));

      const desbloqueado = await desbloquear(concId, empresaId, {
        motivo: 'corrigir classificacao errada',
        username: 'empresa-teste',
      });
      assert.equal(desbloqueado.enviado, false);
      assert.equal(desbloqueado.enviadoEm, null);
      assert.equal(desbloqueado.motivosEdicao.length, 1);
      assert.equal(desbloqueado.motivosEdicao[0].motivo, 'corrigir classificacao errada');
      assert.equal(desbloqueado.motivosEdicao[0].username, 'empresa-teste');

      const removed = await removeById(concId, empresaId);
      assert.equal(removed, true);
      assert.equal(fs.existsSync(snapFile), false);
      assert.equal(await getById(concId, empresaId), null);
      assert.equal(await removeById(concId, empresaId), false);
      concId = null;
    } finally {
      if (empresaId) {
        await pool.query('DELETE FROM empresas WHERE id = $1', [empresaId]);
      }
      if (!skipped) {
        const { closePool } = require('../src/db/pool');
        await closePool().catch(() => {});
      }
    }
  });
});

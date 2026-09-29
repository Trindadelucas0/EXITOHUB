'use strict';

const fs = require('fs');
const path = require('path');
const { getPool } = require('../db/pool');

const CONCI_ROOT = path.join(__dirname, '..', '..');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Aceita `04/2026`, `4/2026` ou `2026-04` → `YYYY-MM`.
 * @returns {string|null}
 */
function parseCompetencia(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  let year;
  let month;

  const iso = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
  } else {
    const br = raw.match(/^(\d{1,2})\/(\d{4})$/);
    if (!br) return null;
    month = Number(br[1]);
    year = Number(br[2]);
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;

  return `${year}-${String(month).padStart(2, '0')}`;
}

/** `YYYY-MM` → `MM/YYYY` para exibição. */
function formatCompetencia(yyyyMm) {
  const s = String(yyyyMm || '');
  if (!/^\d{4}-\d{2}$/.test(s)) return s;
  return `${s.slice(5, 7)}/${s.slice(0, 4)}`;
}

function rowToSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    empresaId: row.empresa_id,
    bancoId: row.banco_id,
    bancoNome: row.banco_nome,
    codigoCredito: row.codigo_credito,
    competencia: row.competencia,
    arquivos: row.arquivos || {},
    resumo: row.resumo || {},
    itens: row.itens || [],
    usedGemini: Boolean(row.used_gemini),
    enviado: Boolean(row.enviado),
    enviadoEm: row.enviado_em ? new Date(row.enviado_em).toISOString() : null,
    motivosEdicao: Array.isArray(row.motivos_edicao) ? row.motivos_edicao : [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function listRowToView(row) {
  if (!row) return null;
  return {
    id: row.id,
    competencia: row.competencia,
    competenciaLabel: formatCompetencia(row.competencia),
    bancoNome: row.banco_nome || '',
    arquivos: row.arquivos || {},
    resumo: row.resumo || {},
    enviado: Boolean(row.enviado),
    enviadoEm: row.enviado_em ? new Date(row.enviado_em).toISOString() : null,
    motivosEdicao: Array.isArray(row.motivos_edicao) ? row.motivos_edicao : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Cópia de cada conciliação fora da pasta do sistema e fora do container do Postgres.
 * Padrão: pasta irmã do HUB (`<pai do HUB>/backups/conci/conciliacoes`), a mesma do backup-conci.sh.
 */
function getSnapshotDir() {
  if (process.env.CONCI_SNAPSHOT_DIR) return process.env.CONCI_SNAPSHOT_DIR;
  const backupDir = process.env.CONCI_BACKUP_DIR
    || path.resolve(CONCI_ROOT, '..', '..', '..', '..', 'backups', 'conci');
  return path.join(backupDir, 'conciliacoes');
}

function snapshotPath(id) {
  const key = String(id || '').toLowerCase();
  if (!UUID_RE.test(key)) throw new Error('id de conciliação inválido');
  return path.join(getSnapshotDir(), `${key}.json`);
}

async function writeSnapshot(row) {
  const emp = await getPool().query('SELECT nome FROM empresas WHERE id = $1', [row.empresa_id]);
  const payload = {
    id: row.id,
    empresa_id: row.empresa_id,
    empresa_nome: emp.rows[0]?.nome || null,
    banco_id: row.banco_id,
    banco_nome: row.banco_nome,
    codigo_credito: row.codigo_credito,
    competencia: row.competencia,
    arquivos: row.arquivos || {},
    resumo: row.resumo || {},
    itens: row.itens || [],
    used_gemini: Boolean(row.used_gemini),
    enviado: Boolean(row.enviado),
    enviado_em: row.enviado_em,
    motivos_edicao: Array.isArray(row.motivos_edicao) ? row.motivos_edicao : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  const fp = snapshotPath(row.id);
  await fs.promises.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(payload), 'utf8');
  await fs.promises.rename(tmp, fp);
}

/** Depois de editar: a linha do banco já mudou; a cópia antiga fica se o disco falhar. */
async function refreshSnapshot(row) {
  if (!row) return;
  try {
    await writeSnapshot(row);
  } catch (err) {
    console.error('[conciliacoes] cópia em disco não atualizada:', row.id, err.message);
  }
}

async function removeSnapshot(id) {
  try {
    await fs.promises.unlink(snapshotPath(id));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[conciliacoes] cópia em disco não apagada:', id, err.message);
    }
  }
}

function normalizarNomeEmpresa(nome) {
  return String(nome || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Empresa que recebe a cópia no boot: o mesmo id, senão a única empresa ativa com o mesmo nome.
 * @returns {{ empresaId: string|null, motivo: string }}
 */
function escolherEmpresaParaSnapshot(snapshot, empresas) {
  const lista = Array.isArray(empresas) ? empresas : [];
  const mesmoId = lista.find((e) => String(e.id) === String(snapshot?.empresa_id));
  if (mesmoId) return { empresaId: mesmoId.id, motivo: 'mesmo-id' };

  const nome = normalizarNomeEmpresa(snapshot?.empresa_nome);
  if (!nome) return { empresaId: null, motivo: 'sem-nome' };

  const iguais = lista.filter((e) => e.ativo !== false && normalizarNomeEmpresa(e.nome) === nome);
  if (iguais.length === 1) return { empresaId: iguais[0].id, motivo: 'mesmo-nome' };
  return { empresaId: null, motivo: iguais.length ? 'nome-ambiguo' : 'nome-nao-encontrado' };
}

async function readSnapshotFiles(dir) {
  try {
    return (await fs.promises.readdir(dir)).filter((name) => name.endsWith('.json'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[conciliacoes] pasta de cópias ilegível:', dir, err.message);
    }
    return [];
  }
}

async function insertFromSnapshot(snap, empresaId) {
  const result = await getPool().query(
    `INSERT INTO conciliacoes (
      id, empresa_id, banco_id, banco_nome, codigo_credito,
      competencia, arquivos, resumo, itens, used_gemini,
      enviado, enviado_em, motivos_edicao, created_at, updated_at
    ) VALUES (
      $1, $2,
      (SELECT b.id FROM bancos b
       WHERE b.id = $3::uuid OR b.nome = $4
       ORDER BY (b.id IS NOT DISTINCT FROM $3::uuid) DESC
       LIMIT 1),
      $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10,
      $11, $12, $13::jsonb,
      COALESCE($14::timestamptz, NOW()), COALESCE($15::timestamptz, NOW())
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING *`,
    [
      snap.id,
      empresaId,
      snap.banco_id || null,
      snap.banco_nome || null,
      snap.codigo_credito != null ? snap.codigo_credito : null,
      snap.competencia,
      JSON.stringify(snap.arquivos || {}),
      JSON.stringify(snap.resumo || {}),
      JSON.stringify(snap.itens || []),
      Boolean(snap.used_gemini),
      Boolean(snap.enviado),
      snap.enviado_em || null,
      JSON.stringify(Array.isArray(snap.motivos_edicao) ? snap.motivos_edicao : []),
      snap.created_at || null,
      snap.updated_at || null,
    ],
  );
  return result.rows[0] || null;
}

/**
 * Boot: repõe no banco a conciliação que só existe na cópia em disco
 * e cria a cópia das linhas que ainda não têm arquivo.
 */
async function reloadSnapshots() {
  const pool = getPool();
  const dir = getSnapshotDir();
  const existentes = new Set(
    (await pool.query('SELECT id FROM conciliacoes')).rows.map((r) => String(r.id).toLowerCase()),
  );
  const empresas = (await pool.query('SELECT id, nome, ativo FROM empresas')).rows;
  const comArquivo = new Set();
  let repostas = 0;

  for (const name of await readSnapshotFiles(dir)) {
    const id = name.slice(0, -'.json'.length).toLowerCase();
    if (!UUID_RE.test(id)) continue;
    comArquivo.add(id);
    if (existentes.has(id)) continue;

    let snap;
    try {
      snap = JSON.parse(await fs.promises.readFile(path.join(dir, name), 'utf8'));
    } catch (err) {
      console.error('[conciliacoes] cópia ilegível:', name, err.message);
      continue;
    }
    if (String(snap.id || '').toLowerCase() !== id) {
      console.error('[conciliacoes] cópia com id diferente do nome do arquivo:', name);
      continue;
    }

    const escolha = escolherEmpresaParaSnapshot(snap, empresas);
    if (!escolha.empresaId) {
      console.warn(
        `[conciliacoes] ${id} (${snap.empresa_nome || 'sem empresa'} ${snap.competencia}) não reposta: ${escolha.motivo}`,
      );
      continue;
    }

    try {
      const row = await insertFromSnapshot(snap, escolha.empresaId);
      if (!row) continue;
      existentes.add(id);
      repostas += 1;
      console.log(`[conciliacoes] reposta do disco: ${id} (${snap.empresa_nome} ${snap.competencia}, ${escolha.motivo})`);
      await refreshSnapshot(row);
    } catch (err) {
      console.error('[conciliacoes] falha ao repor do disco:', id, err.message);
    }
  }

  let copiadas = 0;
  for (const id of existentes) {
    if (comArquivo.has(id)) continue;
    const result = await pool.query('SELECT * FROM conciliacoes WHERE id = $1', [id]);
    if (!result.rows[0]) continue;
    try {
      await writeSnapshot(result.rows[0]);
      copiadas += 1;
    } catch (err) {
      console.error('[conciliacoes] não foi possível criar cópias em', dir, err.message);
      break;
    }
  }

  if (repostas || copiadas) {
    console.log(`[conciliacoes] cópias em ${dir}: ${repostas} reposta(s), ${copiadas} nova(s)`);
  }
  return { repostas, copiadas };
}

/**
 * @param {object} data
 * @param {string} data.id - mesmo UUID da sessão em memória
 */
async function create(data) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO conciliacoes (
      id, empresa_id, banco_id, banco_nome, codigo_credito,
      competencia, arquivos, resumo, itens, used_gemini
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7::jsonb, $8::jsonb, $9::jsonb, $10
    )
    RETURNING *`,
    [
      data.id,
      data.empresaId,
      data.bancoId || null,
      data.bancoNome || null,
      data.codigoCredito != null ? data.codigoCredito : null,
      data.competencia,
      JSON.stringify(data.arquivos || {}),
      JSON.stringify(data.resumo || {}),
      JSON.stringify(data.itens || []),
      Boolean(data.usedGemini),
    ],
  );
  const row = result.rows[0];
  try {
    await writeSnapshot(row);
  } catch (err) {
    await pool.query('DELETE FROM conciliacoes WHERE id = $1', [row.id]).catch(() => {});
    throw new Error(`Conciliação não foi salva: falha ao gravar a cópia em disco (${err.message})`);
  }
  return rowToSession(row);
}

async function update(id, { itens, resumo }) {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE conciliacoes
     SET itens = $2::jsonb,
         resumo = $3::jsonb,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      JSON.stringify(itens || []),
      JSON.stringify(resumo || {}),
    ],
  );
  await refreshSnapshot(result.rows[0]);
  return rowToSession(result.rows[0]);
}

/**
 * Marca a conciliação como enviada: trava edição na revisão/exclusão no histórico
 * até ser desbloqueada com motivo.
 */
async function marcarEnviado(id, empresaId) {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE conciliacoes
     SET enviado = true,
         enviado_em = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND empresa_id = $2
     RETURNING *`,
    [id, empresaId],
  );
  await refreshSnapshot(result.rows[0]);
  return rowToSession(result.rows[0]);
}

/**
 * Desbloqueia uma conciliação enviada, registrando o motivo em `motivos_edicao`.
 * @param {{ motivo: string, username?: string }} info
 */
async function desbloquear(id, empresaId, { motivo, username }) {
  const pool = getPool();
  const entry = [{ motivo, em: new Date().toISOString(), username: username || null }];
  const result = await pool.query(
    `UPDATE conciliacoes
     SET enviado = false,
         enviado_em = NULL,
         motivos_edicao = motivos_edicao || $3::jsonb,
         updated_at = NOW()
     WHERE id = $1 AND empresa_id = $2
     RETURNING *`,
    [id, empresaId, JSON.stringify(entry)],
  );
  await refreshSnapshot(result.rows[0]);
  return rowToSession(result.rows[0]);
}

async function getById(id, empresaId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM conciliacoes
     WHERE id = $1 AND empresa_id = $2
     LIMIT 1`,
    [id, empresaId],
  );
  return rowToSession(result.rows[0]);
}

/**
 * Remove conciliação da empresa. Retorna true se apagou uma linha.
 * Não remove conciliações marcadas como enviadas (precisam ser desbloqueadas antes).
 */
async function removeById(id, empresaId) {
  if (!id || !empresaId) return false;
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM conciliacoes
     WHERE id = $1 AND empresa_id = $2 AND enviado = false
     RETURNING id`,
    [id, empresaId],
  );
  if (result.rowCount === 0) return false;
  await removeSnapshot(id);
  return true;
}

/**
 * @param {string} empresaId
 * @param {{ competencia?: string, de?: string, ate?: string }} filters
 */
async function listByEmpresa(empresaId, filters = {}) {
  const pool = getPool();
  const clauses = ['empresa_id = $1'];
  const params = [empresaId];
  let i = 2;

  const comp = filters.competencia ? parseCompetencia(filters.competencia) : null;
  if (comp) {
    clauses.push(`competencia = $${i++}`);
    params.push(comp);
  }

  if (filters.de) {
    clauses.push(`created_at >= $${i++}::timestamptz`);
    params.push(`${filters.de}T00:00:00`);
  }
  if (filters.ate) {
    clauses.push(`created_at < ($${i++}::date + INTERVAL '1 day')`);
    params.push(filters.ate);
  }

  const result = await pool.query(
    `SELECT id, competencia, banco_nome, arquivos, resumo, created_at, updated_at,
            enviado, enviado_em, motivos_edicao
     FROM conciliacoes
     WHERE ${clauses.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT 200`,
    params,
  );
  return result.rows.map(listRowToView);
}

module.exports = {
  parseCompetencia,
  formatCompetencia,
  create,
  update,
  getById,
  removeById,
  listByEmpresa,
  marcarEnviado,
  desbloquear,
  getSnapshotDir,
  escolherEmpresaParaSnapshot,
  reloadSnapshots,
};

'use strict';

const { getPool } = require('../db/pool');

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
  return rowToSession(result.rows[0]);
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
  return result.rowCount > 0;
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
};

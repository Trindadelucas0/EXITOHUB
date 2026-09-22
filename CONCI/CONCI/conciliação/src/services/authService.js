'use strict';

const path = require('path');
const bcrypt = require('bcryptjs');
const { query, getPool } = require('../db/pool');

function loadHubProvision() {
  if (process.env.HUB_MODE !== '1') return null;
  return require(path.join(__dirname, '..', '..', '..', '..', '..', 'hub', 'provision.js'));
}

async function syncConciUserToHub({
  username,
  password,
  displayName,
  updatePassword = true,
  role = 'empresa',
}) {
  const provision = loadHubProvision();
  if (!provision) return;
  const landingPath = role === 'admin' ? '/conci/admin/empresas' : '/conci/';
  await provision.upsertHubUser({
    username,
    email: provision.conciHubEmail(username),
    password,
    displayName,
    modules: ['conci'],
    modulesExact: true,
    updatePassword,
    landingPath,
  });
}

async function findUserByUsername(username) {
  const result = await query(
    `SELECT u.id, u.username, u.password_hash, u.role, u.empresa_id, u.ativo,
            u.last_empresa_id,
            e.nome AS empresa_nome, e.ativo AS empresa_ativo
     FROM users u
     LEFT JOIN empresas e ON e.id = u.empresa_id
     WHERE LOWER(u.username) = LOWER($1)
     LIMIT 1`,
    [String(username || '').trim()],
  );
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await query(
    `SELECT u.id, u.username, u.role, u.empresa_id, u.ativo,
            e.nome AS empresa_nome, e.ativo AS empresa_ativo
     FROM users u
     LEFT JOIN empresas e ON e.id = u.empresa_id
     WHERE u.id = $1
     LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

async function verifyPassword(user, password) {
  if (!user || !user.password_hash) return false;
  return bcrypt.compare(String(password || ''), user.password_hash);
}

async function listUserEmpresas(userId) {
  if (!userId) return [];
  const result = await query(
    `SELECT e.id, e.nome, e.ativo
     FROM user_empresas ue
     JOIN empresas e ON e.id = ue.empresa_id
     WHERE ue.user_id = $1
     ORDER BY e.nome ASC`,
    [userId],
  );
  if (result.rows.length) return result.rows;
  return [];
}

function toPublicUser(row, empresas) {
  if (!row) return null;
  const memberships = (Array.isArray(empresas) ? empresas : row.empresas || [])
    .filter((item) => item && item.ativo !== false);
  const actingEmpresaId = row.acting_empresa_id || null;
  const actingEmpresaNome = row.acting_empresa_nome || null;
  const actingAllowed = Boolean(
    actingEmpresaId
    && (row.role === 'admin' || memberships.some((item) => String(item.id) === String(actingEmpresaId))),
  );
  const fallback = memberships[0] || null;
  const empresaId = actingAllowed
    ? actingEmpresaId
    : (row.empresa_id || fallback?.id || null);
  const empresaNome = actingAllowed
    ? actingEmpresaNome
    : (row.empresa_nome || memberships.find((item) => String(item.id) === String(empresaId))?.nome || fallback?.nome || null);
  return {
    id: row.id || row.user_id,
    username: row.username,
    role: row.role,
    empresaId: empresaId || null,
    empresaNome: empresaNome || null,
    actingAsEmpresa: Boolean(actingAllowed && row.role === 'admin'),
    empresas: memberships.map((item) => ({ id: item.id, nome: item.nome })),
  };
}

async function createAuthSession(sessionId, userId, maxAgeMs) {
  const expiresAt = new Date(Date.now() + maxAgeMs);
  await query(
    `INSERT INTO auth_sessions (id, user_id, expires_at, acting_empresa_id)
     VALUES ($1, $2, $3, NULL)
     ON CONFLICT (id) DO UPDATE SET
       expires_at = EXCLUDED.expires_at,
       acting_empresa_id = CASE
         WHEN auth_sessions.user_id = EXCLUDED.user_id THEN auth_sessions.acting_empresa_id
         ELSE NULL
       END,
       user_id = EXCLUDED.user_id`,
    [sessionId, userId, expiresAt.toISOString()],
  );
  return expiresAt;
}

async function getAuthSession(sessionId) {
  if (!sessionId) return null;
  const result = await query(
    `SELECT s.id, s.user_id, s.expires_at, s.acting_empresa_id,
            u.username, u.role, u.empresa_id, u.last_empresa_id, u.ativo AS user_ativo,
            e.nome AS empresa_nome, e.ativo AS empresa_ativo,
            ae.nome AS acting_empresa_nome, ae.ativo AS acting_empresa_ativo
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN empresas e ON e.id = u.empresa_id
     LEFT JOIN empresas ae ON ae.id = s.acting_empresa_id
     WHERE s.id = $1
     LIMIT 1`,
    [sessionId],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await destroyAuthSession(sessionId);
    return null;
  }
  if (!row.user_ativo) return null;
  const empresas = await listUserEmpresas(row.user_id);
  row.empresas = empresas;
  const activeMemberships = empresas.filter((item) => item.ativo !== false);
  if (row.role === 'empresa' && !activeMemberships.length && row.empresa_ativo === false) {
    return null;
  }
  if (row.acting_empresa_id) {
    const actingOk = row.acting_empresa_ativo !== false && (
      row.role === 'admin'
      || activeMemberships.some((item) => String(item.id) === String(row.acting_empresa_id))
    );
    if (!actingOk) {
      await clearActingEmpresa(sessionId);
      row.acting_empresa_id = null;
      row.acting_empresa_nome = null;
    }
  }
  return row;
}

async function destroyAuthSession(sessionId) {
  if (!sessionId) return;
  await query('DELETE FROM auth_sessions WHERE id = $1', [sessionId]);
}

async function getEmpresaById(empresaId) {
  if (!empresaId) return null;
  const result = await query(
    `SELECT id, nome, ativo, created_at FROM empresas WHERE id = $1 LIMIT 1`,
    [empresaId],
  );
  return result.rows[0] || null;
}

async function setActingEmpresa(sessionId, empresaId, options = {}) {
  if (!sessionId || !empresaId) throw new Error('Sessao ou empresa invalida');
  const empresa = await getEmpresaById(empresaId);
  if (!empresa) throw new Error('Empresa nao encontrada');
  if (!empresa.ativo) throw new Error('Empresa desativada');
  const allowedIds = options.allowedIds;
  if (Array.isArray(allowedIds) && !allowedIds.some((id) => String(id) === String(empresa.id))) {
    throw new Error('Sem acesso a esta empresa');
  }
  await query(
    `UPDATE auth_sessions SET acting_empresa_id = $1 WHERE id = $2`,
    [empresa.id, sessionId],
  );
  await query(
    `UPDATE users SET last_empresa_id = $1
     WHERE id = (SELECT user_id FROM auth_sessions WHERE id = $2)`,
    [empresa.id, sessionId],
  );
  return empresa;
}

async function clearActingEmpresa(sessionId) {
  if (!sessionId) return;
  await query(
    `UPDATE auth_sessions SET acting_empresa_id = NULL WHERE id = $1`,
    [sessionId],
  );
}

async function listEmpresas() {
  const result = await query(
    `SELECT e.id, e.nome, e.ativo, e.created_at,
            u.id AS user_id, u.username, u.ativo AS user_ativo
     FROM empresas e
     LEFT JOIN users u ON u.empresa_id = e.id AND u.role = 'empresa'
     ORDER BY e.created_at DESC`,
  );
  return result.rows;
}

async function createEmpresa({ nome }) {
  const nomeTrim = String(nome || '').trim();
  if (!nomeTrim) throw new Error('Nome da empresa e obrigatorio');

  const emp = await query(
    `INSERT INTO empresas (nome, ativo) VALUES ($1, true) RETURNING id, nome, ativo, created_at`,
    [nomeTrim],
  );
  return emp.rows[0];
}

async function updateEmpresa(empresaId, { nome, ativo }) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    if (nome !== undefined) {
      const nomeTrim = String(nome || '').trim();
      if (!nomeTrim) throw new Error('Nome da empresa e obrigatorio');
      await client.query('UPDATE empresas SET nome = $1 WHERE id = $2', [nomeTrim, empresaId]);
    }
    if (ativo !== undefined) {
      const flag = ativo === true || ativo === 'true' || ativo === '1' || ativo === 'on';
      await client.query('UPDATE empresas SET ativo = $1 WHERE id = $2', [flag, empresaId]);
      await client.query(
        `UPDATE users SET ativo = $1 WHERE empresa_id = $2 AND role = 'empresa'`,
        [flag, empresaId],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* transacao ja encerrada */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  findUserByUsername,
  findUserById,
  verifyPassword,
  toPublicUser,
  createAuthSession,
  getAuthSession,
  destroyAuthSession,
  listEmpresas,
  listUserEmpresas,
  getEmpresaById,
  setActingEmpresa,
  clearActingEmpresa,
  createEmpresa,
  updateEmpresa,
};

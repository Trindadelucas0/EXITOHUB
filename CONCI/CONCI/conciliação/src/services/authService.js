'use strict';

const bcrypt = require('bcryptjs');
const { query, getPool } = require('../db/pool');

async function findUserByUsername(username) {
  const result = await query(
    `SELECT u.id, u.username, u.password_hash, u.role, u.empresa_id, u.ativo,
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

function toPublicUser(row) {
  if (!row) return null;
  const actingEmpresaId = row.acting_empresa_id || null;
  const actingEmpresaNome = row.acting_empresa_nome || null;
  const baseEmpresaId = row.empresa_id || null;
  const baseEmpresaNome = row.empresa_nome || null;
  const empresaId = actingEmpresaId || baseEmpresaId || null;
  const empresaNome = actingEmpresaId ? actingEmpresaNome : baseEmpresaNome;
  return {
    id: row.id || row.user_id,
    username: row.username,
    role: row.role,
    empresaId,
    empresaNome: empresaNome || null,
    actingAsEmpresa: Boolean(actingEmpresaId && row.role === 'admin'),
  };
}

async function createAuthSession(sessionId, userId, maxAgeMs) {
  const expiresAt = new Date(Date.now() + maxAgeMs);
  await query(
    `INSERT INTO auth_sessions (id, user_id, expires_at, acting_empresa_id)
     VALUES ($1, $2, $3, NULL)
     ON CONFLICT (id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       expires_at = EXCLUDED.expires_at,
       acting_empresa_id = NULL`,
    [sessionId, userId, expiresAt.toISOString()],
  );
  return expiresAt;
}

async function getAuthSession(sessionId) {
  if (!sessionId) return null;
  const result = await query(
    `SELECT s.id, s.user_id, s.expires_at, s.acting_empresa_id,
            u.username, u.role, u.empresa_id, u.ativo AS user_ativo,
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
  if (row.role === 'empresa' && row.empresa_ativo === false) return null;
  if (row.acting_empresa_id) {
    if (row.role !== 'admin' || row.acting_empresa_ativo === false) {
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

async function setActingEmpresa(sessionId, empresaId) {
  if (!sessionId || !empresaId) throw new Error('Sessao ou empresa invalida');
  const empresa = await getEmpresaById(empresaId);
  if (!empresa) throw new Error('Empresa nao encontrada');
  if (!empresa.ativo) throw new Error('Empresa desativada');
  await query(
    `UPDATE auth_sessions SET acting_empresa_id = $1 WHERE id = $2`,
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

async function createEmpresa({ nome, username, password }) {
  const nomeTrim = String(nome || '').trim();
  const userTrim = String(username || '').trim();
  const pass = String(password || '');
  if (!nomeTrim) throw new Error('Nome da empresa e obrigatorio');
  if (!userTrim) throw new Error('Usuario da empresa e obrigatorio');
  if (pass.length < 4) throw new Error('Senha deve ter pelo menos 4 caracteres');

  const conflict = await findUserByUsername(userTrim);
  if (conflict) throw new Error(`Usuario "${userTrim}" ja existe`);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const emp = await client.query(
      `INSERT INTO empresas (nome, ativo) VALUES ($1, true) RETURNING id, nome, ativo, created_at`,
      [nomeTrim],
    );
    const empresa = emp.rows[0];
    const hash = await bcrypt.hash(pass, 10);
    const usr = await client.query(
      `INSERT INTO users (username, password_hash, role, empresa_id, ativo)
       VALUES ($1, $2, 'empresa', $3, true)
       RETURNING id, username`,
      [userTrim, hash, empresa.id],
    );
    await client.query('COMMIT');
    return {
      ...empresa,
      user_id: usr.rows[0].id,
      username: usr.rows[0].username,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateEmpresa(empresaId, { nome, password, ativo }) {
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
    if (password !== undefined && String(password).trim() !== '') {
      const pass = String(password);
      if (pass.length < 4) throw new Error('Senha deve ter pelo menos 4 caracteres');
      const hash = await bcrypt.hash(pass, 10);
      await client.query(
        `UPDATE users SET password_hash = $1 WHERE empresa_id = $2 AND role = 'empresa'`,
        [hash, empresaId],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
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
  getEmpresaById,
  setActingEmpresa,
  clearActingEmpresa,
  createEmpresa,
  updateEmpresa,
};

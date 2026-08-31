'use strict';

const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { query, MODULES } = require('./db');

const COOKIE_NAME = 'exito_hub_sid';
const MAX_AGE_MS = 1000 * 60 * 60 * 8;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  String(header).split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function cookieOptions() {
  const secure =
    process.env.COOKIE_SECURE === '1'
    || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== '0');
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(MAX_AGE_MS / 1000),
  };
}

function setSessionCookie(res, sessionId) {
  const opts = cookieOptions();
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${opts.maxAge}`,
  ];
  if (opts.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}

function toPublicUser(row, modules) {
  if (!row) return null;
  const list = Array.isArray(modules) ? modules : [];
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name || row.username,
    isAdmin: Boolean(row.is_admin),
    active: row.active !== false,
    modules: list,
    canFolha: list.includes('folha'),
    canConci: list.includes('conci'),
    canNcm: list.includes('ncm'),
    landingPath: row.landing_path || null,
  };
}

async function loadModules(userId) {
  const result = await query(
    'SELECT module FROM hub_user_modules WHERE user_id = $1',
    [userId],
  );
  return result.rows.map((r) => r.module);
}

async function findUserByUsername(username) {
  const result = await query(
    `SELECT id, username, email, password_hash, display_name, is_admin, active, landing_path
     FROM hub_users
     WHERE LOWER(username) = LOWER($1)
     LIMIT 1`,
    [String(username || '').trim()],
  );
  return result.rows[0] || null;
}

async function findUserByLogin(login) {
  const value = String(login || '').trim();
  if (!value) return null;
  const byUsername = await findUserByUsername(value);
  if (byUsername) return byUsername;
  const byEmail = await query(
    `SELECT id, username, email, password_hash, display_name, is_admin, active, landing_path
     FROM hub_users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [value],
  );
  return byEmail.rows[0] || null;
}

async function findUserById(id) {
  const result = await query(
    `SELECT id, username, email, display_name, is_admin, active, landing_path
     FROM hub_users WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

async function authenticate(username, password) {
  const user = await findUserByLogin(username);
  if (!user || !user.active) {
    await bcrypt.hash(String(password || ''), 10);
    return null;
  }
  const ok = await bcrypt.compare(String(password || ''), user.password_hash);
  if (!ok) return null;
  const modules = await loadModules(user.id);
  return toPublicUser(user, modules);
}

function postLoginPath(user) {
  const mods = Array.isArray(user?.modules) ? user.modules : [];
  if (mods.length !== 1) return '/';
  const landing = String(user?.landingPath || '').trim();
  const allowed = [
    '/folha/modulos',
    '/conci/',
    '/conci/admin/empresas',
    '/ncm/',
    '/ncm/dashboard',
    '/ncm/escritorio/empresas',
  ];
  if (allowed.includes(landing)) return landing;
  if (mods[0] === 'folha') return '/folha/modulos';
  if (mods[0] === 'conci') return '/conci/';
  if (mods[0] === 'ncm') return '/ncm/';
  return '/';
}

async function createSession(userId) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + MAX_AGE_MS);
  await query(
    `INSERT INTO hub_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [sessionId, userId, expiresAt.toISOString()],
  );
  return sessionId;
}

async function destroySession(sessionId) {
  if (!sessionId) return;
  await query('DELETE FROM hub_sessions WHERE id = $1', [sessionId]);
}

async function getSessionUser(sessionId) {
  if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) return null;
  const result = await query(
    `SELECT s.id AS session_id, s.expires_at,
            u.id, u.username, u.email, u.display_name, u.is_admin, u.active, u.landing_path
     FROM hub_sessions s
     JOIN hub_users u ON u.id = s.user_id
     WHERE s.id = $1
     LIMIT 1`,
    [sessionId],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at) <= new Date()) {
    await destroySession(sessionId);
    return null;
  }
  if (!row.active) return null;
  const modules = await loadModules(row.id);
  return toPublicUser(row, modules);
}

async function getUserFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];
  return getSessionUser(sessionId);
}

async function listUsers() {
  const users = await query(
    `SELECT id, username, email, display_name, is_admin, active, landing_path, created_at
     FROM hub_users
     ORDER BY username`,
  );
  const modules = await query('SELECT user_id, module FROM hub_user_modules');
  const byUser = new Map();
  for (const row of modules.rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id).push(row.module);
  }
  return users.rows.map((u) => toPublicUser(u, byUser.get(u.id) || []));
}

function landingPathForModules(modules, moduleMeta = {}) {
  const allowed = (modules || []).filter((m) => MODULES.includes(m));
  if (allowed.length !== 1) return null;
  if (allowed[0] === 'folha') return '/folha/modulos';
  if (allowed[0] === 'conci') {
    if (moduleMeta.conci?.role === 'admin') return '/conci/admin/empresas';
    return '/conci/';
  }
  if (allowed[0] === 'ncm') {
    if (moduleMeta.ncm?.role === 'superadmin') return '/ncm/escritorio/empresas';
    if (moduleMeta.ncm?.companyId) return '/ncm/dashboard';
    return '/ncm/';
  }
  return null;
}

async function createUser({
  username,
  email,
  password,
  displayName,
  isAdmin,
  modules,
  moduleMeta = {},
}) {
  const allowed = (modules || []).filter((m) => MODULES.includes(m));
  const { validateModuleMeta, provisionUserToModules } = require('./provision-modules');
  validateModuleMeta(allowed, moduleMeta);

  const landingPath = landingPathForModules(allowed, moduleMeta);
  const hash = await bcrypt.hash(String(password), 12);
  const inserted = await query(
    `INSERT INTO hub_users (username, email, password_hash, display_name, is_admin, active, landing_path)
     VALUES ($1, $2, $3, $4, $5, true, $6)
     RETURNING id, username, email, display_name, is_admin, active, landing_path`,
    [
      String(username).trim().toLowerCase(),
      String(email).trim().toLowerCase(),
      hash,
      String(displayName || username).trim(),
      Boolean(isAdmin),
      landingPath,
    ],
  );
  const user = inserted.rows[0];
  for (const mod of allowed) {
    await query(
      `INSERT INTO hub_user_modules (user_id, module) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user.id, mod],
    );
  }

  const publicUser = toPublicUser(user, allowed);
  try {
    await provisionUserToModules(publicUser, {
      modules: allowed,
      moduleMeta,
      passwordHash: hash,
    });
  } catch (err) {
    await query('DELETE FROM hub_user_modules WHERE user_id = $1', [user.id]);
    await query('DELETE FROM hub_users WHERE id = $1', [user.id]);
    throw err;
  }
  return publicUser;
}

async function updateUserWithModules(userId, {
  modules,
  moduleMeta = {},
  password,
  isAdmin,
  active,
}) {
  const row = await findUserById(userId);
  if (!row) throw new Error('Usuário não encontrado.');

  const currentModules = await loadModules(userId);
  const publicUser = toPublicUser(row, currentModules);
  const { validateModuleMeta, syncUserModules } = require('./provision-modules');

  const allowed = (modules || []).filter((m) => MODULES.includes(m));
  validateModuleMeta(allowed, moduleMeta);

  let passwordHash = null;
  if (password && String(password).trim()) {
    passwordHash = await bcrypt.hash(String(password), 12);
    await query('UPDATE hub_users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
  }

  if (typeof isAdmin !== 'undefined') {
    await setUserAdmin(userId, Boolean(isAdmin));
  }
  if (typeof active !== 'undefined') {
    await setUserActive(userId, Boolean(active));
  }

  await query('DELETE FROM hub_user_modules WHERE user_id = $1', [userId]);
  for (const mod of allowed) {
    await query(
      `INSERT INTO hub_user_modules (user_id, module) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, mod],
    );
  }

  const current = await query(
    'SELECT landing_path FROM hub_users WHERE id = $1 LIMIT 1',
    [userId],
  );
  const currentLanding = String(current.rows[0]?.landing_path || '').trim();
  const preserveNcmCompany =
    allowed.length === 1
    && allowed[0] === 'ncm'
    && (currentLanding === '/ncm/dashboard' || currentLanding === '/ncm/escritorio/empresas')
    && moduleMeta.ncm?.companyId;

  let nextLanding = null;
  if (preserveNcmCompany && moduleMeta.ncm?.role !== 'superadmin') {
    nextLanding = currentLanding;
  } else {
    nextLanding = landingPathForModules(allowed, moduleMeta);
  }
  await query('UPDATE hub_users SET landing_path = $1 WHERE id = $2', [nextLanding, userId]);

  const refreshed = await findUserById(userId);
  const updatedPublic = toPublicUser(refreshed, allowed);
  await syncUserModules(updatedPublic, {
    modules: allowed,
    moduleMeta,
    passwordHash,
  });

  return allowed;
}

async function updateUserModules(userId, modules, moduleMeta = {}) {
  return updateUserWithModules(userId, { modules, moduleMeta });
}

async function setUserActive(userId, active) {
  await query('UPDATE hub_users SET active = $1 WHERE id = $2', [Boolean(active), userId]);
}

async function setUserAdmin(userId, isAdmin) {
  await query('UPDATE hub_users SET is_admin = $1 WHERE id = $2', [Boolean(isAdmin), userId]);
}

module.exports = {
  COOKIE_NAME,
  MAX_AGE_MS,
  MODULES,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  authenticate,
  createSession,
  destroySession,
  getSessionUser,
  getUserFromRequest,
  listUsers,
  createUser,
  updateUserModules,
  updateUserWithModules,
  setUserActive,
  setUserAdmin,
  findUserByUsername,
  findUserByLogin,
  findUserById,
  loadModules,
  toPublicUser,
  postLoginPath,
  landingPathForModules,
};

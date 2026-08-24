'use strict';

const { randomUUID } = require('crypto');
const {
  getAuthSession,
  destroyAuthSession,
  createAuthSession,
  toPublicUser,
  findUserByUsername,
} = require('../services/authService');

const COOKIE_NAME = 'conciliacao_sid';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90; // 90 dias

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

function setSessionCookie(res, sessionId) {
  const pathPrefix = process.env.CONCI_BASE_PATH || '/';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=${pathPrefix || '/'}; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`,
  );
}

async function resolveHubSso(req) {
  const hub = req.hubUserForModule || req.hubUser;
  if (!hub) return null;
  const row = await findUserByUsername(hub.username);
  if (!row || !row.ativo) {
    req.hubSsoMissing = true;
    return null;
  }
  if (row.role === 'empresa' && row.empresa_ativo === false) {
    req.hubSsoMissing = true;
    return null;
  }

  const sessionId = req.hubSessionId || randomUUID();
  req.sessionId = sessionId;
  let auth = await getAuthSession(sessionId);
  if (!auth || auth.user_id !== row.id) {
    await createAuthSession(sessionId, row.id, MAX_AGE_MS);
    auth = await getAuthSession(sessionId);
  }
  if (!auth) {
    return toPublicUser(row);
  }
  return toPublicUser({
    id: auth.user_id,
    user_id: auth.user_id,
    username: auth.username,
    role: auth.role,
    empresa_id: auth.empresa_id,
    empresa_nome: auth.empresa_nome,
    acting_empresa_id: auth.acting_empresa_id,
    acting_empresa_nome: auth.acting_empresa_nome,
  });
}

async function sessionMiddleware(req, res, next) {
  try {
    if (process.env.HUB_MODE === '1') {
      req.sessionId = req.hubSessionId || randomUUID();
      res.locals.sessionId = req.sessionId;
      req.user = await resolveHubSso(req);
      res.locals.user = req.user;
      return next();
    }

    const cookies = parseCookies(req.headers.cookie);
    let sessionId = cookies[COOKIE_NAME];
    if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      sessionId = randomUUID();
      setSessionCookie(res, sessionId);
    }
    req.sessionId = sessionId;
    res.locals.sessionId = sessionId;

    const auth = await getAuthSession(sessionId);
    if (auth) {
      req.user = toPublicUser({
        id: auth.user_id,
        user_id: auth.user_id,
        username: auth.username,
        role: auth.role,
        empresa_id: auth.empresa_id,
        empresa_nome: auth.empresa_nome,
        acting_empresa_id: auth.acting_empresa_id,
        acting_empresa_nome: auth.acting_empresa_nome,
      });
    } else {
      req.user = null;
    }
    res.locals.user = req.user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.redirect('/login');
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (req.user.role !== 'admin') {
    return res.status(403).send('Acesso restrito ao administrador');
  }
  return next();
}

function requireEmpresa(req, res, next) {
  if (!req.user) return res.redirect('/login');
  // Conta de empresa OU admin com empresa aberta (acting).
  if (req.user.empresaId && (req.user.role === 'empresa' || req.user.role === 'admin')) {
    return next();
  }
  if (req.user.role === 'admin') {
    return res.redirect('/admin/empresas');
  }
  return res.status(403).send('Acesso restrito a contas de empresa');
}

async function clearAuth(req, res) {
  if (process.env.HUB_MODE === '1') {
    req.user = null;
    res.locals.user = null;
    return;
  }
  if (req.sessionId) {
    await destroyAuthSession(req.sessionId);
  }
  req.user = null;
  res.locals.user = null;
}

module.exports = {
  COOKIE_NAME,
  MAX_AGE_MS,
  parseCookies,
  setSessionCookie,
  sessionMiddleware,
  requireAuth,
  requireAdmin,
  requireEmpresa,
  clearAuth,
};

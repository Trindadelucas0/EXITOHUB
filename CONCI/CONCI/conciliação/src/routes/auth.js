'use strict';

const express = require('express');
const {
  findUserByUsername,
  verifyPassword,
  createAuthSession,
  toPublicUser,
  listUserEmpresas,
  setActingEmpresa,
} = require('../services/authService');
const { MAX_AGE_MS, clearAuth, requireAuth } = require('../middleware/session');
const { migrateAnonymousToEmpresa } = require('../services/preCadastroStore');

const router = express.Router();
const hubMode = () => process.env.HUB_MODE === '1';

router.get('/login', (req, res) => {
  if (hubMode()) {
    return res.redirect('/login');
  }
  if (req.user) {
    if (req.user.role === 'admin') return res.redirect('/admin/empresas');
    return res.redirect('/');
  }
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  if (hubMode()) {
    return res.redirect('/login');
  }
  try {
    const username = req.body.username;
    const password = req.body.password;
    const user = await findUserByUsername(username);
    if (!user || !user.ativo) {
      return res.status(401).render('login', { error: 'Usuario ou senha invalidos' });
    }
    if (user.role === 'empresa') {
      const empresas = await listUserEmpresas(user.id);
      const hasActive = empresas.some((item) => item.ativo !== false);
      if (!hasActive && user.empresa_ativo === false) {
        return res.status(401).render('login', { error: 'Empresa desativada' });
      }
    }
    const ok = await verifyPassword(user, password);
    if (!ok) {
      return res.status(401).render('login', { error: 'Usuario ou senha invalidos' });
    }

    await createAuthSession(req.sessionId, user.id, MAX_AGE_MS);
    const empresas = user.role === 'empresa' ? await listUserEmpresas(user.id) : [];
    req.user = toPublicUser(user, empresas);
    res.locals.user = req.user;

    if (user.role === 'empresa') {
      migrateAnonymousToEmpresa(req.sessionId, req.user.empresaId || user.empresa_id);
      return res.redirect('/');
    }
    return res.redirect('/admin/empresas');
  } catch (err) {
    console.error(err);
    return res.status(500).render('login', { error: `Erro no login: ${err.message}` });
  }
});

router.post('/abrir-empresa', requireAuth, async (req, res) => {
  try {
    const empresaId = String(req.body.empresa_id || '').trim();
    if (!empresaId) throw new Error('Empresa invalida');
    const allowedIds = req.user.role === 'admin'
      ? null
      : (req.user.empresas || []).map((item) => item.id);
    await setActingEmpresa(req.sessionId, empresaId, allowedIds ? { allowedIds } : {});
    return res.redirect('/');
  } catch (err) {
    return res.redirect(`/?erro=${encodeURIComponent(err.message)}`);
  }
});

router.post('/logout', async (req, res) => {
  if (hubMode()) {
    return res.redirect('/logout');
  }
  await clearAuth(req, res);
  return res.redirect('/login');
});

module.exports = router;

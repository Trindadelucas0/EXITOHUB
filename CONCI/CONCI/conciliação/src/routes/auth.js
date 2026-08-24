'use strict';

const express = require('express');
const {
  findUserByUsername,
  verifyPassword,
  createAuthSession,
  toPublicUser,
} = require('../services/authService');
const { MAX_AGE_MS, clearAuth } = require('../middleware/session');
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
    if (user.role === 'empresa' && user.empresa_ativo === false) {
      return res.status(401).render('login', { error: 'Empresa desativada' });
    }
    const ok = await verifyPassword(user, password);
    if (!ok) {
      return res.status(401).render('login', { error: 'Usuario ou senha invalidos' });
    }

    await createAuthSession(req.sessionId, user.id, MAX_AGE_MS);
    req.user = toPublicUser(user);
    res.locals.user = req.user;

    if (user.role === 'empresa' && user.empresa_id) {
      migrateAnonymousToEmpresa(req.sessionId, user.empresa_id);
      return res.redirect('/');
    }
    return res.redirect('/admin/empresas');
  } catch (err) {
    console.error(err);
    return res.status(500).render('login', { error: `Erro no login: ${err.message}` });
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

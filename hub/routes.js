'use strict';

const express = require('express');
const {
  authenticate,
  createSession,
  setSessionCookie,
  listUsers,
  createUser,
  updateUserModules,
  setUserActive,
  setUserAdmin,
  postLoginPath,
  MODULES,
} = require('./auth');
const { requireHubAuth, requireHubAdmin, logoutHub } = require('./middleware');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.hubUser) return res.redirect(postLoginPath(req.hubUser));
  return res.render('login', {
    title: 'EXITO HUB — Login',
    error: null,
    lastUsername: '',
  });
});

router.post('/login', async (req, res) => {
  try {
    const username = req.body.username;
    const password = req.body.password;
    const user = await authenticate(username, password);
    if (!user) {
      return res.status(401).render('login', {
        title: 'EXITO HUB — Login',
        error: 'Usuário ou senha inválidos.',
        lastUsername: username || '',
      });
    }
    const sessionId = await createSession(user.id);
    setSessionCookie(res, sessionId);
    return res.redirect(postLoginPath(user));
  } catch (err) {
    console.error('[hub] login error', err);
    return res.status(500).render('login', {
      title: 'EXITO HUB — Login',
      error: 'Erro ao entrar. Tente novamente.',
      lastUsername: req.body.username || '',
    });
  }
});

router.post('/logout', requireHubAuth, async (req, res) => {
  await logoutHub(req, res);
  return res.redirect('/login');
});

router.get('/logout', requireHubAuth, async (req, res) => {
  await logoutHub(req, res);
  return res.redirect('/login');
});

router.get('/', requireHubAuth, (req, res) => {
  return res.render('home', {
    title: 'EXITO HUB',
    hubUser: req.hubUser,
  });
});

router.get('/admin/usuarios', requireHubAdmin, async (req, res) => {
  const users = await listUsers();
  return res.render('admin-users', {
    title: 'Usuários — EXITO HUB',
    hubUser: req.hubUser,
    users,
    modules: MODULES,
    flash: req.query.ok || null,
    error: req.query.erro || null,
  });
});

router.post('/admin/usuarios', requireHubAdmin, async (req, res) => {
  try {
    const modules = [];
    if (req.body.mod_folha) modules.push('folha');
    if (req.body.mod_conci) modules.push('conci');
    if (req.body.mod_ncm) modules.push('ncm');

    await createUser({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      displayName: req.body.displayName,
      isAdmin: Boolean(req.body.is_admin),
      modules,
    });
    return res.redirect('/admin/usuarios?ok=criado');
  } catch (err) {
    console.error('[hub] create user', err);
    return res.redirect(`/admin/usuarios?erro=${encodeURIComponent(err.message)}`);
  }
});

router.post('/admin/usuarios/:id/modulos', requireHubAdmin, async (req, res) => {
  try {
    const modules = [];
    if (req.body.mod_folha) modules.push('folha');
    if (req.body.mod_conci) modules.push('conci');
    if (req.body.mod_ncm) modules.push('ncm');
    await updateUserModules(req.params.id, modules);
    if (typeof req.body.is_admin !== 'undefined') {
      await setUserAdmin(req.params.id, req.body.is_admin === '1' || req.body.is_admin === 'on');
    }
    if (typeof req.body.active !== 'undefined') {
      await setUserActive(req.params.id, req.body.active === '1' || req.body.active === 'on');
    }
    return res.redirect('/admin/usuarios?ok=atualizado');
  } catch (err) {
    return res.redirect(`/admin/usuarios?erro=${encodeURIComponent(err.message)}`);
  }
});

router.post('/admin/usuarios/:id/status', requireHubAdmin, async (req, res) => {
  try {
    await setUserActive(req.params.id, req.body.active === '1');
    return res.redirect('/admin/usuarios?ok=status');
  } catch (err) {
    return res.redirect(`/admin/usuarios?erro=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;

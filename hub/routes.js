'use strict';

const express = require('express');
const {
  authenticate,
  createSession,
  setSessionCookie,
  clearNcmCookies,
  listUsers,
  createUser,
  updateUserWithModules,
  setUserActive,
  postLoginPath,
  MODULES,
} = require('./auth');
const {
  listConciEmpresas,
  listNcmCompanies,
  loadUsersModuleMeta,
  parseModuleMeta,
} = require('./provision-modules');
const { requireHubAuth, requireHubAdmin, logoutHub } = require('./middleware');
const { getMenuForUser, findSoonModule, AVADESK_URL } = require('./menu-catalog');

const router = express.Router();

const FLASH_OK = {
  criado: 'Usuário criado.',
  atualizado: 'Usuário atualizado.',
  status: 'Situação atualizada.',
};

function parseModules(body) {
  const modules = [];
  if (body.mod_folha) modules.push('folha');
  if (body.mod_conci) modules.push('conci');
  if (body.mod_ncm) modules.push('ncm');
  return modules;
}

function bodyFlag(value) {
  if (Array.isArray(value)) {
    value = value[value.length - 1];
  }
  return value === '1' || value === 'on' || value === true;
}

function pickListFilters(req) {
  const src = req.method === 'POST' ? { ...req.query, ...req.body } : req.query;
  const q = String(src.q || '').trim().slice(0, 120);
  const mod = MODULES.includes(src.mod) ? src.mod : '';
  const sit = src.sit === 'ativo' || src.sit === 'inativo' ? src.sit : '';
  return { q, mod, sit };
}

function usersPath(filters, extra = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.mod) params.set('mod', filters.mod);
  if (filters.sit) params.set('sit', filters.sit);
  if (extra.ok) params.set('ok', extra.ok);
  if (extra.erro) params.set('erro', String(extra.erro).slice(0, 300));
  if (extra.novo) params.set('novo', '1');
  if (extra.editar) params.set('editar', String(extra.editar));
  if (extra.confirmar) params.set('confirmar', String(extra.confirmar));
  const qs = params.toString();
  return qs ? `/admin/usuarios?${qs}` : '/admin/usuarios';
}

function safeErrorMessage(err) {
  return String(err && err.message ? err.message : 'Não foi possível salvar.').slice(0, 300);
}

function companyNameMaps(conciEmpresas, ncmCompanies) {
  const conciById = new Map();
  for (const row of conciEmpresas || []) {
    conciById.set(String(row.id), row.nome);
  }
  const ncmById = new Map();
  for (const row of ncmCompanies || []) {
    ncmById.set(String(row.id), row.name);
  }
  return { conciById, ncmById };
}

function userMatchesFilter(user, meta, filters, names) {
  if (filters.mod === 'folha' && !user.canFolha) return false;
  if (filters.mod === 'conci' && !user.canConci) return false;
  if (filters.mod === 'ncm' && !user.canNcm) return false;
  if (filters.sit === 'ativo' && !user.active) return false;
  if (filters.sit === 'inativo' && user.active) return false;
  if (!filters.q) return true;
  const conciMeta = (meta && meta.conci) || {};
  const ncmMeta = (meta && meta.ncm) || {};
  const hay = [
    user.username,
    user.email,
    user.displayName,
    names.conciById.get(String(conciMeta.empresaId || '')),
    names.ncmById.get(String(ncmMeta.companyId || '')),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(filters.q.toLowerCase());
}

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
    clearNcmCookies(res);
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

router.get('/api/hub/menu', (req, res) => {
  if (!req.hubUser) {
    return res.status(401).json({ error: 'unauthenticated', departments: [] });
  }
  return res.json({ departments: getMenuForUser(req.hubUser) });
});

router.get('/projetos', requireHubAdmin, (req, res) => {
  return res.render('projetos', {
    title: 'Projetos — EXITO HUB',
    hubUser: req.hubUser,
    avadeskUrl: AVADESK_URL,
  });
});

router.get('/hub/modulo/:slug', requireHubAdmin, (req, res) => {
  const item = findSoonModule(req.params.slug);
  if (!item) {
    return res.status(404).render('modulo-em-breve', {
      title: 'Módulo não encontrado — EXITO HUB',
      hubUser: req.hubUser,
      moduleTitle: 'Módulo não encontrado',
      moduleDescription: 'Este destino não existe no menu do HUB.',
      notFound: true,
      current: '',
    });
  }
  return res.render('modulo-em-breve', {
    title: `${item.label} — EXITO HUB`,
    hubUser: req.hubUser,
    moduleTitle: item.label,
    moduleDescription: item.description,
    notFound: false,
    current: item.currentKey,
  });
});

router.get('/admin/usuarios', requireHubAdmin, async (req, res) => {
  const filters = pickListFilters(req);
  const allUsers = await listUsers();
  const userMetaMap = await loadUsersModuleMeta(allUsers);
  const userMeta = Object.fromEntries(userMetaMap);
  const [conciEmpresas, ncmCompanies] = await Promise.all([
    listConciEmpresas().catch(() => []),
    listNcmCompanies().catch(() => []),
  ]);
  const names = companyNameMaps(conciEmpresas, ncmCompanies);
  const users = allUsers.filter((user) =>
    userMatchesFilter(user, userMeta[user.id], filters, names),
  );

  const editingId = String(req.query.editar || '').trim();
  const editingUser = editingId
    ? allUsers.find((user) => String(user.id) === editingId) || null
    : null;
  const sheetMode = editingUser ? 'edit' : (req.query.novo === '1' ? 'create' : null);
  const editingSelf = Boolean(editingUser && String(editingUser.id) === String(req.hubUser.id));
  const confirmOff = sheetMode === 'edit' && !editingSelf && String(req.query.confirmar || '') === 'desativar';
  const flashKey = String(req.query.ok || '');
  const error = req.query.erro ? String(req.query.erro).slice(0, 300) : null;

  return res.render('admin-users', {
    title: 'Usuários — EXITO HUB',
    hubUser: req.hubUser,
    users,
    allUserCount: allUsers.length,
    activeCount: users.filter((user) => user.active).length,
    userMeta,
    conciEmpresas,
    ncmCompanies,
    modules: MODULES,
    filters,
    sheetMode,
    editingUser,
    confirmOff,
    flash: FLASH_OK[flashKey] || null,
    error,
  });
});

router.post('/admin/usuarios', requireHubAdmin, async (req, res) => {
  const filters = pickListFilters(req);
  try {
    const modules = parseModules(req.body);
    const moduleMeta = parseModuleMeta(req.body);

    await createUser({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      displayName: req.body.displayName,
      isAdmin: bodyFlag(req.body.is_admin),
      modules,
      moduleMeta,
    });
    return res.redirect(usersPath(filters, { ok: 'criado' }));
  } catch (err) {
    console.error('[hub] create user', err);
    return res.redirect(usersPath(filters, { novo: true, erro: safeErrorMessage(err) }));
  }
});

router.post('/admin/usuarios/:id/modulos', requireHubAdmin, async (req, res) => {
  const filters = pickListFilters(req);
  const userId = String(req.params.id || '').trim();
  const isSelf = String(req.hubUser.id) === userId;
  const nextAdmin = bodyFlag(req.body.is_admin);
  try {
    if (isSelf && !nextAdmin) {
      return res.redirect(usersPath(filters, {
        editar: userId,
        erro: 'Você não pode remover o próprio acesso de Admin do HUB.',
      }));
    }

    const modules = parseModules(req.body);
    const moduleMeta = parseModuleMeta(req.body);
    const password = String(req.body.password || '').trim() || undefined;

    await updateUserWithModules(userId, {
      modules,
      moduleMeta,
      password,
      isAdmin: nextAdmin,
      active: bodyFlag(req.body.active),
      displayName: req.body.displayName,
    });
    return res.redirect(usersPath(filters, { ok: 'atualizado' }));
  } catch (err) {
    return res.redirect(usersPath(filters, { editar: userId, erro: safeErrorMessage(err) }));
  }
});

router.post('/admin/usuarios/:id/status', requireHubAdmin, async (req, res) => {
  const filters = pickListFilters(req);
  const userId = String(req.params.id || '').trim();
  const nextActive = bodyFlag(req.body.active);
  try {
    if (String(req.hubUser.id) === userId && !nextActive) {
      return res.redirect(usersPath(filters, {
        editar: userId,
        erro: 'Você não pode desativar o próprio login.',
      }));
    }
    await setUserActive(userId, nextActive);
    return res.redirect(usersPath(filters, { ok: 'status' }));
  } catch (err) {
    return res.redirect(usersPath(filters, { editar: userId, erro: safeErrorMessage(err) }));
  }
});

module.exports = router;

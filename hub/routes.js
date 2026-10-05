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
  setUserPhotoFileId,
  findUserById,
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
const { uploadImage, saveUploadedFile } = require('./portal/upload');
const portalRoutes = require('./portal/routes');
const {
  REGIMES,
  REGIMES_FILTRO,
  REGIME_NAO_OPTANTE,
  ANO_PADRAO,
  ESTABELECIMENTOS,
  SITUACOES,
  TIPOS,
  isUuid,
  parseDraft,
  normalizeAno,
  listCarteira,
  countCarteira,
  listRegimeAnos,
  getCarteira,
  empresaTemRegimeLegado,
  createCarteira,
  updateCarteira,
  deleteCarteira,
} = require('./carteira-store');
const { buildCarteiraExcelBuffer } = require('./carteira-excel');

const router = express.Router();

router.use(portalRoutes.router);

const FLASH_OK = {
  criado: 'Usuário criado.',
  atualizado: 'Usuário atualizado.',
  status: 'Situação atualizada.',
  foto: 'Foto atualizada.',
};

function handleUserUploadError(err, res, fallbackPath) {
  if (!err) return false;
  if (err.code === 'LIMIT_FILE_SIZE' || err.status === 413) {
    res.redirect(`${fallbackPath}${fallbackPath.includes('?') ? '&' : '?'}erro=${encodeURIComponent('Arquivo muito grande.')}`);
    return true;
  }
  if (err.code === 'UNSUPPORTED_MEDIA' || err.status === 415) {
    res.redirect(`${fallbackPath}${fallbackPath.includes('?') ? '&' : '?'}erro=${encodeURIComponent('Tipo de arquivo não permitido.')}`);
    return true;
  }
  res.redirect(`${fallbackPath}${fallbackPath.includes('?') ? '&' : '?'}erro=${encodeURIComponent(safeErrorMessage(err))}`);
  return true;
}

async function saveOptionalPhoto(req) {
  if (!req.file) return null;
  const fileRow = await saveUploadedFile(req.file, req.hubUser.id);
  return fileRow?.id || null;
}

function isSeedMasterUser(user) {
  if (!user) return false;
  const username = String(process.env.HUB_SEED_ADMIN_USER || 'exito').trim().toLowerCase();
  const email = String(process.env.HUB_SEED_ADMIN_EMAIL || 'escritorio@local').trim().toLowerCase();
  const login = String(user.username || '').toLowerCase();
  const mail = String(user.email || '').toLowerCase();
  return login === username || login === 'exito' || mail === email;
}

function isMasterAccess(user, meta) {
  if (isSeedMasterUser(user)) return true;
  const ncmRole = meta && meta.ncm && meta.ncm.role;
  const conciRole = meta && meta.conci && meta.conci.role;
  return Boolean(
    user
    && user.isAdmin
    && user.canFolha
    && user.canConci
    && user.canNcm
    && ncmRole === 'superadmin'
    && conciRole === 'admin',
  );
}

function applyMasterBody(body) {
  body.mod_folha = '1';
  body.mod_conci = '1';
  body.mod_ncm = '1';
  body.is_admin = '1';
  body.is_master = '1';
  body.conci_role = 'admin';
  body.ncm_role = 'superadmin';
}

function parseModules(body) {
  if (bodyFlag(body.is_master)) {
    return ['folha', 'conci', 'ncm'];
  }
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

const CARTEIRA_FLASH = {
  criado: 'Empresa cadastrada.',
  atualizado: 'Empresa atualizada.',
  excluido: 'Empresa excluída.',
};

function queryValue(src, key) {
  let value = src && src[key];
  if (Array.isArray(value)) value = value[value.length - 1];
  return String(value == null ? '' : value).trim();
}

const CARTEIRA_PAGE_SIZE = 25;

function pickCarteiraPage(req) {
  const src = req.method === 'POST' ? { ...req.query, ...req.body } : req.query;
  const raw = Number.parseInt(queryValue(src, 'p'), 10);
  return Number.isFinite(raw) && raw >= 1 ? raw : 1;
}

function pickCarteiraFilters(req) {
  const src = req.method === 'POST' ? { ...req.query, ...req.body } : req.query;
  const q = queryValue(src, 'q').slice(0, 120);
  const sitRaw = queryValue(src, 'sit');
  const regimeRaw = queryValue(src, 'regime');
  const tipoRaw = queryValue(src, 'tipo');
  const sit = SITUACOES.includes(sitRaw) ? sitRaw : '';
  const regime = REGIMES_FILTRO.includes(regimeRaw) ? regimeRaw : '';
  const tipo = TIPOS.includes(tipoRaw) ? tipoRaw : '';
  const anoRaw = req.method === 'POST'
    ? (queryValue(req.body, 'ano_lista') || queryValue(req.query, 'ano'))
    : queryValue(req.query, 'ano');
  const ano = normalizeAno(anoRaw);
  return { q, sit, regime, tipo, ano, p: pickCarteiraPage(req) };
}

function carteiraPath(filters, extra = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.sit) params.set('sit', filters.sit);
  if (filters.ano && Number(filters.ano) !== ANO_PADRAO) params.set('ano', String(filters.ano));
  if (filters.regime) params.set('regime', filters.regime);
  if (filters.tipo) params.set('tipo', filters.tipo);
  if (Number(filters.p) > 1) params.set('p', String(filters.p));
  if (extra.ok) params.set('ok', extra.ok);
  if (extra.erro) params.set('erro', String(extra.erro).slice(0, 300));
  if (extra.novo) params.set('novo', '1');
  if (extra.editar) params.set('editar', String(extra.editar));
  if (extra.confirmar) params.set('confirmar', String(extra.confirmar));
  const qs = params.toString();
  return qs ? `/carteira?${qs}` : '/carteira';
}

async function renderCarteira(req, res, extras = {}) {
  const filters = extras.filters || pickCarteiraFilters(req);
  const hasFilter = Boolean(
    filters.q || filters.sit || filters.regime || filters.tipo
    || (Number(filters.ano) && Number(filters.ano) !== ANO_PADRAO),
  );
  const [totalCount, filteredCountRaw, anos] = await Promise.all([
    countCarteira(),
    hasFilter ? countCarteira(filters) : Promise.resolve(null),
    listRegimeAnos(),
  ]);
  const filteredCount = hasFilter ? filteredCountRaw : totalCount;
  const pageCount = Math.max(1, Math.ceil(filteredCount / CARTEIRA_PAGE_SIZE));
  let page = Number.parseInt(filters.p, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > pageCount) page = pageCount;
  filters.p = page;
  const offset = (page - 1) * CARTEIRA_PAGE_SIZE;
  const empresas = await listCarteira(filters, { limit: CARTEIRA_PAGE_SIZE, offset });
  const from = filteredCount === 0 ? 0 : offset + 1;
  const to = offset + empresas.length;
  let editing = extras.editing || null;
  let sheetMode = extras.sheetMode || null;
  let regimeLegadoDisponivel = false;
  if (!sheetMode && !editing) {
    const editId = String(req.query.editar || '').trim();
    if (editId) {
      editing = await getCarteira(editId);
      sheetMode = editing ? 'edit' : null;
    } else if (req.query.novo === '1') {
      sheetMode = 'create';
    }
  }
  if (editing && editing.id) {
    regimeLegadoDisponivel = await empresaTemRegimeLegado(editing.id);
  }
  const status = extras.status || 200;
  return res.status(status).render('carteira', {
    title: 'Controle da Carteira de Clientes — EXITO HUB',
    hubUser: req.hubUser,
    empresas,
    totalCount,
    filteredCount,
    page,
    pageCount,
    pageSize: CARTEIRA_PAGE_SIZE,
    from,
    to,
    filters,
    hasFilter,
    sheetMode,
    editing,
    sheetValues: extras.sheetValues || editing || {},
    fieldError: extras.fieldError || '',
    confirmar: String(extras.confirmar != null ? extras.confirmar : req.query.confirmar || ''),
    flash: extras.flash != null ? extras.flash : (CARTEIRA_FLASH[String(req.query.ok || '')] || null),
    error: extras.error != null ? extras.error : (req.query.erro ? String(req.query.erro).slice(0, 300) : null),
    regimes: REGIMES,
    regimesFiltro: REGIMES_FILTRO,
    regimeNaoOptante: REGIME_NAO_OPTANTE,
    regimeLegadoDisponivel,
    anos,
    estabelecimentos: ESTABELECIMENTOS,
    situacoes: SITUACOES,
  });
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
    ...(Array.isArray(conciMeta.empresaIds) && conciMeta.empresaIds.length
      ? conciMeta.empresaIds.map((id) => names.conciById.get(String(id)))
      : [names.conciById.get(String(conciMeta.empresaId || ''))]),
    ...(Array.isArray(ncmMeta.companyIds) && ncmMeta.companyIds.length
      ? ncmMeta.companyIds.map((id) => names.ncmById.get(String(id)))
      : [names.ncmById.get(String(ncmMeta.companyId || ''))]),
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

function moduleAccessFor(user) {
  if (!user) return [];
  const items = [];
  if (user.canNcm) items.push({ href: '/ncm/', label: 'Auditor Fiscal', hint: 'Fiscal' });
  if (user.canConci) items.push({ href: '/conci/', label: 'Conciliação', hint: 'Contábil' });
  if (user.canFolha) items.push({ href: '/folha/dashboard', label: 'Controle folha mensal', hint: 'Folha' });
  if (user.isAdmin) {
    items.push({ href: '/admin/portal', label: 'Portal Corporativo', hint: 'Administrativo' });
    items.push({ href: '/admin/usuarios', label: 'Gerenciar usuários', hint: 'Administrativo' });
  }
  return items;
}

router.get('/', requireHubAuth, async (req, res) => {
  try {
    const portal = await portalRoutes.loadHomeForRequest(req.hubUser);
    const flashKey = String(req.query.ok || '');
    return res.render('home', {
      title: 'EXITO HUB',
      hubUser: req.hubUser,
      greeting: portal.greeting,
      needsOnboarding: portal.needsOnboarding,
      onboardingProgress: portal.onboardingProgress,
      cards: portal.cards,
      quickCards: portal.quickCards,
      links: portal.links,
      contacts: portal.contacts,
      contents: portal.contents,
      announcements: portal.announcements || [],
      announcementKinds: portal.announcementKinds || [],
      agendaToday: portal.agendaToday || [],
      agendaTomorrow: portal.agendaTomorrow || [],
      emptyStates: portal.emptyStates,
      contactDepartments: portal.contactDepartments,
      moduleAccess: moduleAccessFor(req.hubUser),
      flash: flashKey === 'concluido' ? 'Integração concluída. Bem-vindo ao HUB.' : null,
      error: req.query.erro ? String(req.query.erro).slice(0, 300) : null,
    });
  } catch (err) {
    console.error('[hub] home', err);
    return res.status(500).send('Erro ao carregar a Home');
  }
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

router.get('/carteira/excel', requireHubAdmin, async (req, res) => {
  try {
    const filters = pickCarteiraFilters(req);
    const [rows, anos] = await Promise.all([
      listCarteira(filters),
      listRegimeAnos(),
    ]);
    const buffer = await buildCarteiraExcelBuffer(rows, anos);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="carteira-empresas.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[hub] carteira excel', err);
    return res.status(500).send('Não foi possível gerar o Excel.');
  }
});

router.get('/carteira', requireHubAdmin, async (req, res) => {
  try {
    return await renderCarteira(req, res);
  } catch (err) {
    console.error('[hub] carteira list', err);
    return res.status(500).send('Erro ao carregar a carteira');
  }
});

router.post('/carteira', requireHubAdmin, async (req, res) => {
  const filters = pickCarteiraFilters(req);
  try {
    await createCarteira(req.body);
    return res.redirect(carteiraPath(filters, { ok: 'criado' }));
  } catch (err) {
    if (err.status === 400 || err.status === 409) {
      return renderCarteira(req, res, {
        filters,
        sheetMode: 'create',
        sheetValues: parseDraft(req.body),
        fieldError: err.field || '',
        error: err.message,
        status: err.status,
      });
    }
    console.error('[hub] carteira create', err);
    return renderCarteira(req, res, {
      filters,
      sheetMode: 'create',
      sheetValues: parseDraft(req.body),
      error: 'Não foi possível salvar.',
      status: 500,
    });
  }
});

router.post('/carteira/:id/excluir', requireHubAdmin, async (req, res) => {
  const filters = pickCarteiraFilters(req);
  try {
    if (!isUuid(req.params.id)) return res.status(404).send('Empresa não encontrada');
    const existing = await getCarteira(req.params.id);
    if (!existing) return res.status(404).send('Empresa não encontrada');
    if (String(req.body && req.body.confirm) !== '1') {
      return res.redirect(carteiraPath(filters, { confirmar: req.params.id }));
    }
    await deleteCarteira(req.params.id);
    return res.redirect(carteiraPath(filters, { ok: 'excluido' }));
  } catch (err) {
    console.error('[hub] carteira delete', err);
    return res.redirect(carteiraPath(filters, { erro: 'Não foi possível excluir.' }));
  }
});

router.post('/carteira/:id', requireHubAdmin, async (req, res) => {
  const filters = pickCarteiraFilters(req);
  try {
    if (!isUuid(req.params.id)) return res.status(404).send('Empresa não encontrada');
    const updated = await updateCarteira(req.params.id, req.body);
    if (!updated) return res.status(404).send('Empresa não encontrada');
    return res.redirect(carteiraPath(filters, { ok: 'atualizado' }));
  } catch (err) {
    if (err.status === 400 || err.status === 409) {
      return renderCarteira(req, res, {
        filters,
        sheetMode: 'edit',
        editing: { id: req.params.id, ...parseDraft(req.body) },
        sheetValues: { id: req.params.id, ...parseDraft(req.body) },
        fieldError: err.field || '',
        error: err.message,
        status: err.status,
      });
    }
    console.error('[hub] carteira update', err);
    return renderCarteira(req, res, {
      filters,
      sheetMode: 'edit',
      editing: { id: req.params.id, ...parseDraft(req.body) },
      sheetValues: { id: req.params.id, ...parseDraft(req.body) },
      error: 'Não foi possível salvar.',
      status: 500,
    });
  }
});

router.get('/hub/modulo/:slug', requireHubAdmin, (req, res) => {
  if (req.params.slug === 'carteira') {
    return res.redirect('/carteira');
  }
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
  const sheetMeta = editingUser ? (userMeta[editingUser.id] || {}) : {};
  const sheetIsMaster = isMasterAccess(editingUser, sheetMeta);
  const sheetMasterLocked = isSeedMasterUser(editingUser);
  const confirmOff = sheetMode === 'edit' && !editingSelf && String(req.query.confirmar || '') === 'desativar';
  const flashKey = String(req.query.ok || '');
  const error = req.query.erro ? String(req.query.erro).slice(0, 300) : null;

  return res.render('admin-users', {
    title: 'Usuários — EXITO HUB',
    hubUser: req.hubUser,
    users,
    allUserCount: allUsers.length,
    activeCount: allUsers.filter((user) => user.active).length,
    allUsersForKpi: allUsers,
    userMeta,
    conciEmpresas,
    ncmCompanies,
    modules: MODULES,
    filters,
    sheetMode,
    editingUser,
    sheetIsMaster,
    sheetMasterLocked,
    confirmOff,
    flash: FLASH_OK[flashKey] || null,
    error,
  });
});

router.post('/admin/usuarios', requireHubAdmin, (req, res) => {
  uploadImage.single('photo')(req, res, async (err) => {
    const filters = pickListFilters(req);
    if (handleUserUploadError(err, res, usersPath(filters, { novo: true }))) return;
    try {
      if (bodyFlag(req.body.is_master)) applyMasterBody(req.body);
      const modules = parseModules(req.body);
      const moduleMeta = parseModuleMeta(req.body);
      const photoFileId = await saveOptionalPhoto(req);

      await createUser({
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
        displayName: req.body.displayName,
        isAdmin: bodyFlag(req.body.is_admin) || bodyFlag(req.body.is_master),
        modules,
        moduleMeta,
        photoFileId,
      });
      return res.redirect(usersPath(filters, { ok: 'criado' }));
    } catch (e) {
      console.error('[hub] create user', e);
      return res.redirect(usersPath(filters, { novo: true, erro: safeErrorMessage(e) }));
    }
  });
});

router.post('/admin/usuarios/:id/modulos', requireHubAdmin, (req, res) => {
  uploadImage.single('photo')(req, res, async (err) => {
    const filters = pickListFilters(req);
    const userId = String(req.params.id || '').trim();
    const isSelf = String(req.hubUser.id) === userId;
    if (handleUserUploadError(err, res, usersPath(filters, { editar: userId }))) return;
    try {
      const editing = await findUserById(userId);
      if (isSeedMasterUser(editing)) applyMasterBody(req.body);
      else if (bodyFlag(req.body.is_master)) applyMasterBody(req.body);

      const nextAdmin = bodyFlag(req.body.is_admin);
      if (isSelf && !nextAdmin) {
        return res.redirect(usersPath(filters, {
          editar: userId,
          erro: 'Você não pode remover o próprio acesso de Admin do HUB.',
        }));
      }

      const modules = parseModules(req.body);
      const moduleMeta = parseModuleMeta(req.body);
      const password = String(req.body.password || '').trim() || undefined;
      const photoFileId = await saveOptionalPhoto(req);

      await updateUserWithModules(userId, {
        modules,
        moduleMeta,
        password,
        isAdmin: nextAdmin,
        active: bodyFlag(req.body.active),
        displayName: req.body.displayName,
        photoFileId,
      });
      return res.redirect(usersPath(filters, { ok: 'atualizado' }));
    } catch (e) {
      return res.redirect(usersPath(filters, { editar: userId, erro: safeErrorMessage(e) }));
    }
  });
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
    const editing = await findUserById(userId);
    if (isSeedMasterUser(editing) && !nextActive) {
      return res.redirect(usersPath(filters, {
        editar: userId,
        erro: 'O login master EXITO não pode ser desativado.',
      }));
    }
    await setUserActive(userId, nextActive);
    return res.redirect(usersPath(filters, { ok: 'status' }));
  } catch (err) {
    return res.redirect(usersPath(filters, { editar: userId, erro: safeErrorMessage(err) }));
  }
});

router.get('/perfil', requireHubAuth, async (req, res) => {
  const flashKey = String(req.query.ok || '');
  const error = req.query.erro ? String(req.query.erro).slice(0, 300) : null;
  return res.render('perfil', {
    title: 'Meu perfil — EXITO HUB',
    hubUser: req.hubUser,
    flash: FLASH_OK[flashKey] || null,
    error,
  });
});

router.post('/perfil/foto', requireHubAuth, (req, res) => {
  uploadImage.single('photo')(req, res, async (err) => {
    if (handleUserUploadError(err, res, '/perfil')) return;
    try {
      if (!req.file) {
        return res.redirect(`/perfil?erro=${encodeURIComponent('Selecione uma imagem jpeg, png ou webp.')}`);
      }
      const photoFileId = await saveOptionalPhoto(req);
      if (!photoFileId) {
        return res.redirect(`/perfil?erro=${encodeURIComponent('Não foi possível salvar a foto.')}`);
      }
      await setUserPhotoFileId(req.hubUser.id, photoFileId);
      return res.redirect('/perfil?ok=foto');
    } catch (e) {
      return res.redirect(`/perfil?erro=${encodeURIComponent(safeErrorMessage(e))}`);
    }
  });
});

module.exports = router;

'use strict';

const express = require('express');
const fs = require('fs');
const { requireHubAuth, requireHubAdmin } = require('../middleware');
const {
  loadHome,
  greetingForNow,
  listAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  setAnnouncementActive,
  deleteAnnouncement,
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  setEventActive,
  deleteEvent,
  listEventsForUser,
  loadAgendaDays,
  parseAgendaRange,
  toCalendarEvent,
  loadPortalAdminSummary,
  formatDatetimeLocal,
  countTable,
  listLinks,
  getLink,
  createLink,
  updateLink,
  setLinkActive,
  deleteLink,
  listContacts,
  getContact,
  createContact,
  updateContact,
  setContactActive,
  deleteContact,
  listContents,
  getContent,
  createContent,
  updateContent,
  setContentPublished,
  deleteContent,
  kindMeta,
  kindFromSlug,
  listItems,
  getItem,
  createItem,
  updateItem,
  setItemActive,
  countItemProgressByKind,
  countItems,
  deleteItem,
  setVideoFeatured,
  listItemProgress,
  decorateItemsForUser,
  firstUnlockedIncompleteId,
  completeItem,
  getActiveTrack,
  listSteps,
  getStep,
  enrichStepMedia,
  loadOnboardingForUser,
  startOnboarding,
  completeStep,
  completeOnboarding,
  updateStep,
  createStep,
  deleteStep,
  countStepProgressByTrack,
  moveStep,
  listOnboardingUsers,
  getUserOnboardingDetail,
  adminSetOnboardingStatus,
  bodyFlag,
  LINK_CATEGORIES,
  CONTACT_DEPARTMENTS,
  ITEM_DEPARTMENTS,
  CONTENT_CATEGORIES,
  ANNOUNCEMENT_KINDS,
  ITEM_KINDS,
  TARGET_TYPES,
  EMPTY_STATES,
} = require('./store');
const {
  uploadImage,
  uploadDoc,
  saveUploadedFile,
  getFileById,
  absolutePathForStored,
} = require('./upload');
const { IMAGE_MIMES } = require('./constants');
const { listUsers } = require('../auth');

const router = express.Router();

function safeError(err) {
  return String(err && err.message ? err.message : 'Não foi possível salvar.').slice(0, 300);
}

function flashRedirect(res, path, { ok, erro } = {}) {
  const params = new URLSearchParams();
  if (ok) params.set('ok', ok);
  if (erro) params.set('erro', String(erro).slice(0, 300));
  const qs = params.toString();
  if (!qs) return res.redirect(path);
  const join = path.includes('?') ? '&' : '?';
  return res.redirect(`${path}${join}${qs}`);
}

function pickFlash(req) {
  const flashKey = String(req.query.ok || '');
  const messages = {
    salvo: 'Salvo com sucesso.',
    criado: 'Criado com sucesso.',
    atualizado: 'Atualizado com sucesso.',
    status: 'Situação atualizada.',
    concluido: 'Integração concluída.',
    marcado: 'Item marcado como concluído.',
    excluido: 'Excluído.',
    destaque: 'Destaque atualizado.',
  };
  return {
    flash: messages[flashKey] || null,
    error: req.query.erro ? String(req.query.erro).slice(0, 300) : null,
  };
}

function readSit(value) {
  const sit = String(value || '').trim().toLowerCase();
  return sit === 'ativo' || sit === 'inativo' ? sit : '';
}

function readFilters(req) {
  const src = Object.assign({}, req.query || {}, req.body || {});
  return {
    q: String(src.q || '').trim().slice(0, 80),
    sit: readSit(src.sit),
    cat: String(src.cat || '').trim().slice(0, 60),
    dep: String(src.dep || '').trim().slice(0, 60),
  };
}

function hasAdminFilter(filters) {
  return Boolean(filters.q || filters.sit || filters.cat || filters.dep);
}

function querySuffix(path, filters, extra) {
  const full = listReturn(path, filters, extra);
  const q = full.indexOf('?');
  return q === -1 ? '' : full.slice(q);
}

function listReturn(path, filters, extra) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.sit) params.set('sit', filters.sit);
  if (filters.cat) params.set('cat', filters.cat);
  if (filters.dep) params.set('dep', filters.dep);
  if (extra) {
    Object.keys(extra).forEach((key) => {
      if (extra[key]) params.set(key, String(extra[key]));
    });
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function isConfirmed(body) {
  return String(body && body.confirm) === '1';
}

function handleUploadError(err, res, fallbackPath) {
  if (!err) return false;
  if (err.code === 'LIMIT_FILE_SIZE' || err.status === 413) {
    flashRedirect(res, fallbackPath, { erro: 'Arquivo muito grande.' });
    return true;
  }
  if (err.code === 'UNSUPPORTED_MEDIA' || err.status === 415) {
    flashRedirect(res, fallbackPath, { erro: 'Tipo de arquivo não permitido.' });
    return true;
  }
  flashRedirect(res, fallbackPath, { erro: safeError(err) });
  return true;
}

/* ───────────── Media (auth) ───────────── */

router.get('/portal/media/:fileId', requireHubAuth, async (req, res) => {
  try {
    const file = await getFileById(req.params.fileId);
    if (!file) return res.status(404).send('Arquivo não encontrado');
    const abs = absolutePathForStored(file.stored_path);
    if (!abs || !fs.existsSync(abs)) return res.status(404).send('Arquivo não encontrado');
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return fs.createReadStream(abs).pipe(res);
  } catch (err) {
    console.error('[portal] media', err);
    return res.status(500).send('Erro ao ler arquivo');
  }
});

/* ───────────── Portal pages (auth) ───────────── */

const SEQUENTIAL_AREA_BY_SLUG = {
  videos: { kind: 'video', current: 'portal-videos', queryKey: 'v' },
  diagrama: { kind: 'diagram', current: 'portal-diagrama', queryKey: null },
  informativos: { kind: 'informative', current: 'portal-informativos', queryKey: null },
  catalogos: { kind: 'catalog', current: 'portal-catalogos', queryKey: null },
  documentos: { kind: 'document', current: 'portal-documentos', queryKey: null },
};

async function renderSequentialArea(req, res, slug) {
  const cfg = SEQUENTIAL_AREA_BY_SLUG[slug];
  if (!cfg) return res.status(404).send('Área não encontrada');
  const meta = kindMeta(cfg.kind);
  const rawItems = await listItems(cfg.kind, { activeOnly: true });
  const progress = await listItemProgress(req.hubUser.id);
  let selectedId = cfg.queryKey && req.query[cfg.queryKey]
    ? String(req.query[cfg.queryKey]).slice(0, 64)
    : null;

  let items = decorateItemsForUser(rawItems, progress, { selectedId });

  if (selectedId) {
    const selected = items.find((it) => String(it.id) === String(selectedId));
    if (!selected || !selected.unlocked) {
      const fallback = firstUnlockedIncompleteId(items);
      const q = cfg.queryKey && fallback ? `?${cfg.queryKey}=${fallback}` : '';
      return res.redirect(`/portal/${slug}${q}`);
    }
  } else if (cfg.queryKey && items.length) {
    selectedId = firstUnlockedIncompleteId(items);
    items = decorateItemsForUser(rawItems, progress, { selectedId });
  }

  const locals = {
    title: `${meta.label} — EXITO HUB`,
    hubUser: req.hubUser,
    current: cfg.current,
    meta,
    items,
    progressEnabled: true,
    completePath: `/portal/${slug}`,
    ...pickFlash(req),
  };
  if (cfg.kind === 'video') locals.selectedVideoId = selectedId;
  if (cfg.kind === 'document') locals.emptyMessage = EMPTY_STATES.items;
  return res.render('portal/area', locals);
}

async function handleCompleteItem(req, res, slug) {
  const cfg = SEQUENTIAL_AREA_BY_SLUG[slug];
  if (!cfg) return res.status(404).send('Área não encontrada');
  try {
    const result = await completeItem(req.hubUser.id, req.params.id);
    const next = result.nextId;
    let dest = `/portal/${slug}`;
    if (cfg.queryKey && next) dest += `?${cfg.queryKey}=${next}`;
    else if (cfg.queryKey) dest += `?${cfg.queryKey}=${req.params.id}`;
    return flashRedirect(res, dest, { ok: 'marcado' });
  } catch (err) {
    return flashRedirect(res, `/portal/${slug}`, { erro: safeError(err) });
  }
}

router.get('/portal/videos', requireHubAuth, (req, res) => renderSequentialArea(req, res, 'videos'));
router.post('/portal/videos/:id/complete', requireHubAuth, (req, res) => handleCompleteItem(req, res, 'videos'));

router.get('/portal/pops', requireHubAuth, async (req, res) => {
  const kind = 'pop';
  const meta = kindMeta(kind);
  const items = await listItems(kind, { activeOnly: true });
  const selectedPopId = req.query.p ? String(req.query.p).slice(0, 64) : null;
  return res.render('portal/area', {
    title: `${meta.label} — EXITO HUB`,
    hubUser: req.hubUser,
    current: 'portal-pops',
    meta,
    items,
    selectedPopId,
    progressEnabled: false,
    ...pickFlash(req),
  });
});

router.get('/portal/diagrama', requireHubAuth, (req, res) => renderSequentialArea(req, res, 'diagrama'));
router.post('/portal/diagrama/:id/complete', requireHubAuth, (req, res) => handleCompleteItem(req, res, 'diagrama'));

router.get('/portal/informativos', requireHubAuth, (req, res) => renderSequentialArea(req, res, 'informativos'));
router.post('/portal/informativos/:id/complete', requireHubAuth, (req, res) => handleCompleteItem(req, res, 'informativos'));

router.get('/portal/catalogos', requireHubAuth, (req, res) => renderSequentialArea(req, res, 'catalogos'));
router.post('/portal/catalogos/:id/complete', requireHubAuth, (req, res) => handleCompleteItem(req, res, 'catalogos'));

router.get('/portal/logos', requireHubAuth, (req, res) => {
  return res.redirect('/');
});

router.get('/portal/documentos', requireHubAuth, (req, res) => renderSequentialArea(req, res, 'documentos'));
router.post('/portal/documentos/:id/complete', requireHubAuth, (req, res) => handleCompleteItem(req, res, 'documentos'));

router.get('/portal/comunicados', requireHubAuth, async (req, res) => {
  const announcements = await listAnnouncements({ activeOnly: true });
  return res.render('portal/placeholder', {
    title: 'Comunicados — EXITO HUB',
    hubUser: req.hubUser,
    current: 'portal-comunicados',
    pageTitle: 'Comunicados',
    pageIcon: 'mark_email_read',
    pageLead: EMPTY_STATES.announcements,
    pageHint: EMPTY_STATES.announcementsSupport,
    listKind: 'announcements',
    listItems: announcements,
  });
});

router.get('/portal/eventos', requireHubAuth, (_req, res) => {
  return res.redirect('/portal/agenda');
});

router.get('/portal/agenda', requireHubAuth, async (req, res) => {
  try {
    const agenda = await loadAgendaDays(req.hubUser.id);
    return res.render('portal/agenda', {
      title: 'Agenda Êxito — EXITO HUB',
      hubUser: req.hubUser,
      current: 'portal-agenda',
      agendaToday: agenda.agendaToday,
      agendaTomorrow: agenda.agendaTomorrow,
      emptyStates: EMPTY_STATES,
    });
  } catch (err) {
    console.error('[hub] agenda', err);
    return res.status(500).send('Não foi possível carregar a agenda.');
  }
});

router.get('/portal/agenda/eventos', requireHubAuth, async (req, res) => {
  let range;
  try {
    range = parseAgendaRange(req.query.start, req.query.end);
  } catch (err) {
    return res.status(400).json({ error: safeError(err) });
  }
  try {
    const events = await listEventsForUser(req.hubUser.id, range);
    return res.json(events.map(toCalendarEvent));
  } catch (err) {
    console.error('[hub] agenda eventos', err);
    return res.status(500).json({ error: 'Não foi possível carregar a agenda.' });
  }
});

/* ───────────── Onboarding (auth) ───────────── */

router.get('/portal/onboarding', requireHubAuth, async (req, res) => {
  try {
    if (req.hubUser.onboardingStatus === 'PENDING') {
      await startOnboarding(req.hubUser.id);
      req.hubUser.onboardingStatus = 'IN_PROGRESS';
    }
    const data = await loadOnboardingForUser(req.hubUser);
    const completionLinks = ['video', 'diagram', 'pop', 'document'].map((key) => ITEM_KINDS[key]);
    return res.render('portal/onboarding', {
      title: 'Integração — EXITO HUB',
      hubUser: req.hubUser,
      current: 'portal-onboarding',
      completionLinks,
      ...data,
      ...pickFlash(req),
    });
  } catch (err) {
    console.error('[portal] onboarding', err);
    return res.status(500).send('Erro ao carregar integração');
  }
});

router.post('/portal/onboarding/start', requireHubAuth, async (req, res) => {
  try {
    await startOnboarding(req.hubUser.id);
    return res.redirect('/portal/onboarding');
  } catch (err) {
    return flashRedirect(res, '/portal/onboarding', { erro: safeError(err) });
  }
});

router.post('/portal/onboarding/steps/:id/complete', requireHubAuth, async (req, res) => {
  try {
    await completeStep(req.hubUser.id, req.params.id);
    return flashRedirect(res, '/portal/onboarding', { ok: 'atualizado' });
  } catch (err) {
    return flashRedirect(res, '/portal/onboarding', { erro: safeError(err) });
  }
});

router.post('/portal/onboarding/complete', requireHubAuth, async (req, res) => {
  try {
    await completeOnboarding(req.hubUser.id);
    return flashRedirect(res, '/', { ok: 'concluido' });
  } catch (err) {
    return flashRedirect(res, '/portal/onboarding', { erro: safeError(err) });
  }
});

router.get('/portal/onboarding/etapas/:id', requireHubAuth, async (req, res) => {
  try {
    const raw = await getStep(req.params.id);
    if (!raw || !raw.is_active) {
      return res.status(404).send('Módulo não encontrado');
    }
    const step = enrichStepMedia(raw);
    const modLabel = 'MOD-' + String(step.position).padStart(2, '0');
    return res.render('portal/onboarding-step', {
      title: `${step.title} — Integração — EXITO HUB`,
      hubUser: req.hubUser,
      current: 'portal-onboarding',
      step,
      modLabel,
      ...pickFlash(req),
    });
  } catch (err) {
    console.error('[portal] onboarding step', err);
    return res.status(500).send('Erro ao carregar módulo');
  }
});

/* ───────────── Admin index ───────────── */

router.get('/admin/portal', requireHubAdmin, async (req, res) => {
  try {
    const summary = await loadPortalAdminSummary();
    return res.render('admin/portal-index', {
      title: 'Portal Corporativo — EXITO HUB',
      hubUser: req.hubUser,
      current: 'admin-portal',
      itemKinds: ITEM_KINDS,
      summary,
      ...pickFlash(req),
    });
  } catch (err) {
    console.error('[hub] admin portal', err);
    return res.status(500).send('Erro ao carregar o portal');
  }
});

router.get('/admin/portal/configuracoes', requireHubAdmin, (req, res) => {
  return res.redirect('/admin/portal');
});

/* ───────────── Admin Links ───────────── */

async function renderLinksAdmin(req, res, editing, title) {
  const filters = readFilters(req);
  const back = listReturn('/admin/portal/links', filters);
  if (editing && editing.id && !editing.name && editing.missing) return res.redirect(back);
  const [links, totalCount] = await Promise.all([
    listLinks({ q: filters.q, sit: filters.sit, category: filters.cat }),
    countTable('portal_links'),
  ]);
  return res.render('admin/portal-links', {
    title,
    hubUser: req.hubUser,
    current: 'admin-portal',
    links,
    editing,
    categories: LINK_CATEGORIES,
    filters,
    filtersQuery: querySuffix('/admin/portal/links', filters),
    hasFilter: hasAdminFilter(filters),
    totalCount,
    confirmar: String(req.query.confirmar || ''),
    ...pickFlash(req),
  });
}

router.get('/admin/portal/links', requireHubAdmin, (req, res) => {
  return renderLinksAdmin(req, res, null, 'Links Úteis — Portal');
});

router.get('/admin/portal/links/novo', requireHubAdmin, (req, res) => {
  return renderLinksAdmin(req, res, { id: null }, 'Novo link — Portal');
});

router.get('/admin/portal/links/:id/editar', requireHubAdmin, async (req, res) => {
  const editing = await getLink(req.params.id);
  if (!editing) return res.redirect(listReturn('/admin/portal/links', readFilters(req)));
  return renderLinksAdmin(req, res, editing, 'Editar link — Portal');
});

router.post('/admin/portal/links', requireHubAdmin, async (req, res) => {
  const filters = readFilters(req);
  try {
    await createLink(req.body);
    return flashRedirect(res, listReturn('/admin/portal/links', filters), { ok: 'criado' });
  } catch (err) {
    return flashRedirect(res, listReturn('/admin/portal/links/novo', filters), { erro: safeError(err) });
  }
});

router.post('/admin/portal/links/:id/status', requireHubAdmin, async (req, res) => {
  const filters = readFilters(req);
  try {
    await setLinkActive(req.params.id, bodyFlag(req.body.active));
    return flashRedirect(res, listReturn('/admin/portal/links', filters), { ok: 'status' });
  } catch (err) {
    return flashRedirect(res, listReturn('/admin/portal/links', filters), { erro: safeError(err) });
  }
});

router.post('/admin/portal/links/:id/excluir', requireHubAdmin, async (req, res) => {
  const filters = readFilters(req);
  const back = listReturn('/admin/portal/links', filters);
  try {
    const existing = await getLink(req.params.id);
    if (!existing) return flashRedirect(res, back, { erro: 'Link não encontrado.' });
    if (!isConfirmed(req.body)) {
      return res.redirect(listReturn('/admin/portal/links', filters, { confirmar: req.params.id }));
    }
    await deleteLink(req.params.id);
    return flashRedirect(res, back, { ok: 'excluido' });
  } catch (err) {
    return flashRedirect(res, back, { erro: safeError(err) });
  }
});

router.post('/admin/portal/links/:id', requireHubAdmin, async (req, res) => {
  const filters = readFilters(req);
  try {
    await updateLink(req.params.id, req.body);
    return flashRedirect(res, listReturn('/admin/portal/links', filters), { ok: 'atualizado' });
  } catch (err) {
    return flashRedirect(res, listReturn(`/admin/portal/links/${req.params.id}/editar`, filters), { erro: safeError(err) });
  }
});

/* ───────────── Admin Contacts ───────────── */

async function renderContactsAdmin(req, res, editing, title) {
  const filters = readFilters(req);
  const [contacts, totalCount] = await Promise.all([
    listContacts({ q: filters.q, sit: filters.sit, department: filters.dep }),
    countTable('portal_contacts'),
  ]);
  return res.render('admin/portal-contacts', {
    title,
    hubUser: req.hubUser,
    current: 'admin-portal',
    contacts,
    editing,
    departments: CONTACT_DEPARTMENTS,
    filters,
    filtersQuery: querySuffix('/admin/portal/contatos', filters),
    hasFilter: hasAdminFilter(filters),
    totalCount,
    confirmar: String(req.query.confirmar || ''),
    ...pickFlash(req),
  });
}

router.get('/admin/portal/contatos', requireHubAdmin, (req, res) => {
  return renderContactsAdmin(req, res, null, 'Contatos Úteis — Portal');
});

router.get('/admin/portal/contatos/novo', requireHubAdmin, (req, res) => {
  return renderContactsAdmin(req, res, { id: null }, 'Novo contato — Portal');
});

router.get('/admin/portal/contatos/:id/editar', requireHubAdmin, async (req, res) => {
  const editing = await getContact(req.params.id);
  if (!editing) return res.redirect(listReturn('/admin/portal/contatos', readFilters(req)));
  return renderContactsAdmin(req, res, editing, 'Editar contato — Portal');
});

router.post('/admin/portal/contatos', requireHubAdmin, (req, res) => {
  const filters = readFilters(req);
  uploadImage.single('photo')(req, res, async (err) => {
    if (handleUploadError(err, res, listReturn('/admin/portal/contatos/novo', filters))) return;
    try {
      const fileRow = req.file ? await saveUploadedFile(req.file, req.hubUser.id) : null;
      await createContact(req.body, fileRow?.id || null);
      return flashRedirect(res, listReturn('/admin/portal/contatos', filters), { ok: 'criado' });
    } catch (e) {
      return flashRedirect(res, listReturn('/admin/portal/contatos/novo', filters), { erro: safeError(e) });
    }
  });
});

router.post('/admin/portal/contatos/:id/status', requireHubAdmin, async (req, res) => {
  const back = listReturn('/admin/portal/contatos', readFilters(req));
  try {
    await setContactActive(req.params.id, bodyFlag(req.body.active));
    return flashRedirect(res, back, { ok: 'status' });
  } catch (err) {
    return flashRedirect(res, back, { erro: safeError(err) });
  }
});

router.post('/admin/portal/contatos/:id/excluir', requireHubAdmin, async (req, res) => {
  const filters = readFilters(req);
  const back = listReturn('/admin/portal/contatos', filters);
  try {
    const existing = await getContact(req.params.id);
    if (!existing) return flashRedirect(res, back, { erro: 'Contato não encontrado.' });
    if (!isConfirmed(req.body)) {
      return res.redirect(listReturn('/admin/portal/contatos', filters, { confirmar: req.params.id }));
    }
    await deleteContact(req.params.id);
    return flashRedirect(res, back, { ok: 'excluido' });
  } catch (err) {
    return flashRedirect(res, back, { erro: safeError(err) });
  }
});

router.post('/admin/portal/contatos/:id', requireHubAdmin, (req, res) => {
  const filters = readFilters(req);
  uploadImage.single('photo')(req, res, async (err) => {
    const editPath = listReturn(`/admin/portal/contatos/${req.params.id}/editar`, filters);
    if (handleUploadError(err, res, editPath)) return;
    try {
      const fileRow = req.file ? await saveUploadedFile(req.file, req.hubUser.id) : null;
      await updateContact(req.params.id, req.body, fileRow?.id || null);
      return flashRedirect(res, listReturn('/admin/portal/contatos', filters), { ok: 'atualizado' });
    } catch (e) {
      return flashRedirect(res, editPath, { erro: safeError(e) });
    }
  });
});

/* ───────────── Admin Contents ───────────── */

async function renderContentsAdmin(req, res, editing, title) {
  const filters = readFilters(req);
  const [contents, totalCount] = await Promise.all([
    listContents({ q: filters.q, sit: filters.sit }),
    countTable('portal_contents'),
  ]);
  return res.render('admin/portal-contents', {
    title,
    hubUser: req.hubUser,
    current: 'admin-portal',
    contents,
    editing,
    categories: CONTENT_CATEGORIES,
    targetTypes: TARGET_TYPES,
    filters,
    filtersQuery: querySuffix('/admin/portal/conteudos', filters),
    hasFilter: hasAdminFilter(filters),
    totalCount,
    confirmar: String(req.query.confirmar || ''),
    ...pickFlash(req),
  });
}

router.get('/admin/portal/conteudos', requireHubAdmin, (req, res) => {
  return renderContentsAdmin(req, res, null, 'Conteúdos Êxito — Portal');
});

router.get('/admin/portal/conteudos/novo', requireHubAdmin, (req, res) => {
  return renderContentsAdmin(req, res, { id: null }, 'Novo conteúdo — Portal');
});

router.get('/admin/portal/conteudos/:id/editar', requireHubAdmin, async (req, res) => {
  const editing = await getContent(req.params.id);
  if (!editing) return res.redirect(listReturn('/admin/portal/conteudos', readFilters(req)));
  return renderContentsAdmin(req, res, editing, 'Editar conteúdo — Portal');
});

router.post('/admin/portal/conteudos', requireHubAdmin, (req, res) => {
  const filters = readFilters(req);
  uploadImage.single('image')(req, res, async (err) => {
    if (handleUploadError(err, res, listReturn('/admin/portal/conteudos/novo', filters))) return;
    try {
      const fileRow = req.file ? await saveUploadedFile(req.file, req.hubUser.id) : null;
      await createContent(req.body, fileRow?.id || null);
      return flashRedirect(res, listReturn('/admin/portal/conteudos', filters), { ok: 'criado' });
    } catch (e) {
      return flashRedirect(res, listReturn('/admin/portal/conteudos/novo', filters), { erro: safeError(e) });
    }
  });
});

router.post('/admin/portal/conteudos/:id/status', requireHubAdmin, async (req, res) => {
  const back = listReturn('/admin/portal/conteudos', readFilters(req));
  try {
    await setContentPublished(req.params.id, bodyFlag(req.body.active));
    return flashRedirect(res, back, { ok: 'status' });
  } catch (err) {
    return flashRedirect(res, back, { erro: safeError(err) });
  }
});

router.post('/admin/portal/conteudos/:id/excluir', requireHubAdmin, async (req, res) => {
  const filters = readFilters(req);
  const back = listReturn('/admin/portal/conteudos', filters);
  try {
    const existing = await getContent(req.params.id);
    if (!existing) return flashRedirect(res, back, { erro: 'Conteúdo não encontrado.' });
    if (!isConfirmed(req.body)) {
      return res.redirect(listReturn('/admin/portal/conteudos', filters, { confirmar: req.params.id }));
    }
    await deleteContent(req.params.id);
    return flashRedirect(res, back, { ok: 'excluido' });
  } catch (err) {
    return flashRedirect(res, back, { erro: safeError(err) });
  }
});

router.post('/admin/portal/conteudos/:id', requireHubAdmin, (req, res) => {
  const filters = readFilters(req);
  uploadImage.single('image')(req, res, async (err) => {
    const editPath = listReturn(`/admin/portal/conteudos/${req.params.id}/editar`, filters);
    if (handleUploadError(err, res, editPath)) return;
    try {
      const fileRow = req.file ? await saveUploadedFile(req.file, req.hubUser.id) : null;
      await updateContent(req.params.id, req.body, fileRow?.id || null);
      return flashRedirect(res, listReturn('/admin/portal/conteudos', filters), { ok: 'atualizado' });
    } catch (e) {
      return flashRedirect(res, editPath, { erro: safeError(e) });
    }
  });
});

/* ───────────── Admin Items by kind ───────────── */

function itemUploader(kind) {
  if (kind === 'video') return uploadImage;
  if (kind === 'diagram') return uploadImage;
  return uploadDoc;
}

function itemUploadFields(kind) {
  return itemUploader(kind).fields([
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]);
}

async function saveItemUploads(req) {
  const file = req.files && req.files.file && req.files.file[0] ? req.files.file[0] : null;
  const thumb = req.files && req.files.thumbnail && req.files.thumbnail[0] ? req.files.thumbnail[0] : null;
  if (thumb) {
    const mime = String(thumb.mimetype || '').toLowerCase();
    if (!IMAGE_MIMES.has(mime)) {
      const err = new Error('A capa deve ser uma imagem (JPEG, PNG ou WebP).');
      err.status = 415;
      err.code = 'UNSUPPORTED_MEDIA';
      throw err;
    }
  }
  const fileRow = file ? await saveUploadedFile(file, req.hubUser.id) : null;
  const thumbRow = thumb ? await saveUploadedFile(thumb, req.hubUser.id) : null;
  return { fileId: fileRow?.id || null, thumbnailId: thumbRow?.id || null };
}

async function renderItemsAdmin(req, res, kind, editing) {
  const meta = kindMeta(kind);
  if (!meta) return res.status(404).send('Tipo não encontrado');
  const filters = readFilters(req);
  const base = `/admin/portal/itens/${kind}`;
  const [items, totalCount, progressMap] = await Promise.all([
    listItems(kind, { q: filters.q, sit: filters.sit }),
    countItems(kind),
    countItemProgressByKind(kind),
  ]);
  const flash = pickFlash(req);
  return res.render('admin/portal-items', {
    title: editing && editing.id ? `Editar — ${meta.label}` : (editing ? `Novo — ${meta.label}` : `${meta.label} — Portal`),
    hubUser: req.hubUser,
    current: 'admin-portal',
    kind,
    meta,
    items,
    editing,
    departments: ITEM_DEPARTMENTS,
    filters,
    filtersQuery: querySuffix(base, filters),
    hasFilter: hasAdminFilter(filters),
    totalCount,
    progressMap,
    confirmar: String(req.query.confirmar || ''),
    confirmarDestaque: kind === 'video' ? String(req.query.confirmarDestaque || '') : '',
    flash: flash.flash,
    error: flash.error,
  });
}

router.get('/admin/portal/itens/:kind', requireHubAdmin, (req, res) => {
  return renderItemsAdmin(req, res, req.params.kind, null);
});

router.get('/admin/portal/itens/:kind/novo', requireHubAdmin, (req, res) => {
  return renderItemsAdmin(req, res, req.params.kind, { id: null });
});

router.get('/admin/portal/itens/:kind/:id/editar', requireHubAdmin, async (req, res) => {
  const kind = req.params.kind;
  if (!kindMeta(kind)) return res.status(404).send('Tipo não encontrado');
  const editing = await getItem(req.params.id);
  if (!editing || editing.kind !== kind) {
    return res.redirect(listReturn(`/admin/portal/itens/${kind}`, readFilters(req)));
  }
  return renderItemsAdmin(req, res, kind, editing);
});

router.post('/admin/portal/itens/:kind', requireHubAdmin, (req, res) => {
  const kind = req.params.kind;
  if (!kindMeta(kind)) return res.status(404).send('Tipo não encontrado');
  const filters = readFilters(req);
  const base = `/admin/portal/itens/${kind}`;
  itemUploadFields(kind)(req, res, async (err) => {
    if (handleUploadError(err, res, listReturn(`${base}/novo`, filters))) return;
    try {
      const { fileId, thumbnailId } = await saveItemUploads(req);
      await createItem(kind, req.body, fileId, thumbnailId);
      return flashRedirect(res, listReturn(base, filters), { ok: 'criado' });
    } catch (e) {
      return flashRedirect(res, listReturn(`${base}/novo`, filters), { erro: safeError(e) });
    }
  });
});

router.post('/admin/portal/itens/:kind/:id/status', requireHubAdmin, async (req, res) => {
  const kind = req.params.kind;
  const back = listReturn(`/admin/portal/itens/${kind}`, readFilters(req));
  try {
    await setItemActive(req.params.id, bodyFlag(req.body.active));
    return flashRedirect(res, back, { ok: 'status' });
  } catch (err) {
    return flashRedirect(res, back, { erro: safeError(err) });
  }
});

router.post('/admin/portal/itens/:kind/:id/excluir', requireHubAdmin, async (req, res) => {
  const kind = req.params.kind;
  const filters = readFilters(req);
  const back = listReturn(`/admin/portal/itens/${kind}`, filters);
  try {
    const existing = await getItem(req.params.id);
    if (!existing || existing.kind !== kind) {
      return flashRedirect(res, back, { erro: 'Item não encontrado.' });
    }
    if (!isConfirmed(req.body)) {
      return res.redirect(listReturn(`/admin/portal/itens/${kind}`, filters, { confirmar: req.params.id }));
    }
    await deleteItem(req.params.id);
    return flashRedirect(res, back, { ok: 'excluido' });
  } catch (err) {
    return flashRedirect(res, back, { erro: safeError(err) });
  }
});

router.post('/admin/portal/itens/video/:id/destaque', requireHubAdmin, async (req, res) => {
  const filters = readFilters(req);
  const back = listReturn('/admin/portal/itens/video', filters);
  try {
    await setVideoFeatured(req.params.id, { confirm: isConfirmed(req.body) });
    return flashRedirect(res, back, { ok: 'destaque' });
  } catch (err) {
    if (err && err.code === 'FEATURED_EXISTS') {
      return res.redirect(listReturn('/admin/portal/itens/video', filters, { confirmarDestaque: req.params.id }));
    }
    return flashRedirect(res, back, { erro: safeError(err) });
  }
});

router.post('/admin/portal/itens/:kind/:id', requireHubAdmin, (req, res) => {
  const kind = req.params.kind;
  if (!kindMeta(kind)) return res.status(404).send('Tipo não encontrado');
  const filters = readFilters(req);
  const base = `/admin/portal/itens/${kind}`;
  itemUploadFields(kind)(req, res, async (err) => {
    const editPath = listReturn(`${base}/${req.params.id}/editar`, filters);
    if (handleUploadError(err, res, editPath)) return;
    try {
      const { fileId, thumbnailId } = await saveItemUploads(req);
      const updated = await updateItem(req.params.id, req.body, fileId, thumbnailId);
      if (!updated || updated.kind !== kind) {
        return flashRedirect(res, listReturn(base, filters), { erro: 'Item não encontrado.' });
      }
      return flashRedirect(res, listReturn(base, filters), { ok: 'atualizado' });
    } catch (e) {
      return flashRedirect(res, editPath, { erro: safeError(e) });
    }
  });
});

/* ───────────── Admin announcements and events ───────────── */

async function renderAnnouncementsAdmin(req, res, editing, title) {
  const filters = readFilters(req);
  const [announcements, totalCount] = await Promise.all([
    listAnnouncements({ activeOnly: false, q: filters.q, sit: filters.sit }),
    countTable('portal_announcements'),
  ]);
  return res.render('admin/portal-announcements', {
    title,
    hubUser: req.hubUser,
    current: 'admin-portal',
    announcements,
    announcementKinds: ANNOUNCEMENT_KINDS,
    editing,
    filters,
    filtersQuery: querySuffix('/admin/portal/comunicados', filters),
    hasFilter: hasAdminFilter(filters),
    totalCount,
    confirmar: String(req.query.confirmar || ''),
    formatDatetimeLocal,
    ...pickFlash(req),
  });
}

router.get('/admin/portal/comunicados', requireHubAdmin, (req, res) => {
  return renderAnnouncementsAdmin(req, res, null, 'Comunicados — Portal');
});

router.get('/admin/portal/comunicados/novo', requireHubAdmin, (req, res) => {
  return renderAnnouncementsAdmin(req, res, {
    id: null,
    kind: 'operacional',
    published_at: new Date().toISOString(),
    is_active: true,
  }, 'Novo comunicado — Portal');
});

router.get('/admin/portal/comunicados/:id/editar', requireHubAdmin, async (req, res) => {
  const editing = await getAnnouncement(req.params.id);
  if (!editing) return res.redirect(listReturn('/admin/portal/comunicados', readFilters(req)));
  return renderAnnouncementsAdmin(req, res, editing, 'Editar comunicado — Portal');
});

router.post('/admin/portal/comunicados', requireHubAdmin, async (req, res) => {
  const filters = readFilters(req);
  try {
    await createAnnouncement(req.body);
    return flashRedirect(res, listReturn('/admin/portal/comunicados', filters), { ok: 'criado' });
  } catch (err) {
    return flashRedirect(res, listReturn('/admin/portal/comunicados/novo', filters), { erro: safeError(err) });
  }
});

router.post('/admin/portal/comunicados/:id/status', requireHubAdmin, async (req, res) => {
  const back = listReturn('/admin/portal/comunicados', readFilters(req));
  try {
    await setAnnouncementActive(req.params.id, bodyFlag(req.body.active));
    return flashRedirect(res, back, { ok: 'status' });
  } catch (err) {
    return flashRedirect(res, back, { erro: safeError(err) });
  }
});

router.post('/admin/portal/comunicados/:id/excluir', requireHubAdmin, async (req, res) => {
  const filters = readFilters(req);
  const back = listReturn('/admin/portal/comunicados', filters);
  try {
    const existing = await getAnnouncement(req.params.id);
    if (!existing) return flashRedirect(res, back, { erro: 'Comunicado não encontrado.' });
    if (!isConfirmed(req.body)) {
      return res.redirect(listReturn('/admin/portal/comunicados', filters, { confirmar: req.params.id }));
    }
    await deleteAnnouncement(req.params.id);
    return flashRedirect(res, back, { ok: 'excluido' });
  } catch (err) {
    return flashRedirect(res, back, { erro: safeError(err) });
  }
});

router.post('/admin/portal/comunicados/:id', requireHubAdmin, async (req, res) => {
  const filters = readFilters(req);
  try {
    const updated = await updateAnnouncement(req.params.id, req.body);
    if (!updated) {
      return flashRedirect(res, listReturn('/admin/portal/comunicados', filters), { erro: 'Comunicado não encontrado.' });
    }
    return flashRedirect(res, listReturn('/admin/portal/comunicados', filters), { ok: 'atualizado' });
  } catch (err) {
    return flashRedirect(res, listReturn(`/admin/portal/comunicados/${req.params.id}/editar`, filters), { erro: safeError(err) });
  }
});

async function renderEventsAdmin(req, res, editing, title) {
  const filters = readFilters(req);
  const [events, totalCount, allUsers] = await Promise.all([
    listEvents({ activeOnly: false, q: filters.q, sit: filters.sit }),
    countTable('portal_events'),
    editing ? listUsers() : Promise.resolve([]),
  ]);
  const users = allUsers
    .filter((u) => u.active)
    .sort((a, b) => String(a.displayName).localeCompare(String(b.displayName), 'pt-BR'));
  return res.render('admin/portal-events', {
    title,
    hubUser: req.hubUser,
    current: 'admin-portal',
    events,
    editing,
    users,
    filters,
    filtersQuery: querySuffix('/admin/portal/eventos', filters),
    hasFilter: hasAdminFilter(filters),
    totalCount,
    confirmar: String(req.query.confirmar || ''),
    formatDatetimeLocal,
    ...pickFlash(req),
  });
}

router.get('/admin/portal/eventos', requireHubAdmin, (req, res) => {
  return renderEventsAdmin(req, res, null, 'Eventos — Portal');
});

router.get('/admin/portal/eventos/novo', requireHubAdmin, (req, res) => {
  return renderEventsAdmin(req, res, {
    id: null,
    starts_at: new Date().toISOString(),
    is_active: true,
  }, 'Novo evento — Portal');
});

router.get('/admin/portal/eventos/:id/editar', requireHubAdmin, async (req, res) => {
  const editing = await getEvent(req.params.id);
  if (!editing) return res.redirect(listReturn('/admin/portal/eventos', readFilters(req)));
  return renderEventsAdmin(req, res, editing, 'Editar evento — Portal');
});

router.post('/admin/portal/eventos', requireHubAdmin, async (req, res) => {
  const filters = readFilters(req);
  try {
    await createEvent(req.body);
    return flashRedirect(res, listReturn('/admin/portal/eventos', filters), { ok: 'criado' });
  } catch (err) {
    return flashRedirect(res, listReturn('/admin/portal/eventos/novo', filters), { erro: safeError(err) });
  }
});

router.post('/admin/portal/eventos/:id/status', requireHubAdmin, async (req, res) => {
  const back = listReturn('/admin/portal/eventos', readFilters(req));
  try {
    await setEventActive(req.params.id, bodyFlag(req.body.active));
    return flashRedirect(res, back, { ok: 'status' });
  } catch (err) {
    return flashRedirect(res, back, { erro: safeError(err) });
  }
});

router.post('/admin/portal/eventos/:id/excluir', requireHubAdmin, async (req, res) => {
  const filters = readFilters(req);
  const back = listReturn('/admin/portal/eventos', filters);
  try {
    const existing = await getEvent(req.params.id);
    if (!existing) return flashRedirect(res, back, { erro: 'Evento não encontrado.' });
    if (!isConfirmed(req.body)) {
      return res.redirect(listReturn('/admin/portal/eventos', filters, { confirmar: req.params.id }));
    }
    await deleteEvent(req.params.id);
    return flashRedirect(res, back, { ok: 'excluido' });
  } catch (err) {
    return flashRedirect(res, back, { erro: safeError(err) });
  }
});

router.post('/admin/portal/eventos/:id', requireHubAdmin, async (req, res) => {
  const filters = readFilters(req);
  try {
    const updated = await updateEvent(req.params.id, req.body);
    if (!updated) {
      return flashRedirect(res, listReturn('/admin/portal/eventos', filters), { erro: 'Evento não encontrado.' });
    }
    return flashRedirect(res, listReturn('/admin/portal/eventos', filters), { ok: 'atualizado' });
  } catch (err) {
    return flashRedirect(res, listReturn(`/admin/portal/eventos/${req.params.id}/editar`, filters), { erro: safeError(err) });
  }
});

/* ───────────── Admin Onboarding ───────────── */

async function renderOnboardingAdmin(req, res, editingStep, title) {
  const track = await getActiveTrack();
  const steps = track ? await listSteps(track.id) : [];
  const stepProgress = track ? await countStepProgressByTrack(track.id) : {};
  return res.render('admin/portal-onboarding', {
    title,
    hubUser: req.hubUser,
    current: 'admin-portal',
    track,
    steps,
    editingStep,
    stepProgress,
    confirmar: String(req.query.confirmar || ''),
    ...pickFlash(req),
  });
}

router.get('/admin/portal/onboarding', requireHubAdmin, (req, res) => {
  return renderOnboardingAdmin(req, res, null, 'Onboarding — Portal');
});

router.get('/admin/portal/onboarding/etapas/nova', requireHubAdmin, async (req, res) => {
  const track = await getActiveTrack();
  const steps = track ? await listSteps(track.id) : [];
  return renderOnboardingAdmin(req, res, {
    id: null,
    position: steps.length + 1,
    is_active: true,
  }, 'Nova etapa — Portal');
});

router.get('/admin/portal/onboarding/etapas/:id/editar', requireHubAdmin, async (req, res) => {
  const track = await getActiveTrack();
  const steps = track ? await listSteps(track.id) : [];
  const editingStep = steps.find((s) => String(s.id) === String(req.params.id)) || null;
  if (!editingStep) return res.redirect('/admin/portal/onboarding');
  return renderOnboardingAdmin(req, res, editingStep, 'Editar etapa — Portal');
});

function rejectNonPdf(file, res, fallbackPath) {
  if (file && String(file.mimetype || '').toLowerCase() !== 'application/pdf') {
    flashRedirect(res, fallbackPath, { erro: 'Envie apenas PDF neste campo.' });
    return true;
  }
  return false;
}

router.post('/admin/portal/onboarding/etapas/nova', requireHubAdmin, (req, res) => {
  uploadDoc.single('pdf')(req, res, async (err) => {
    if (handleUploadError(err, res, '/admin/portal/onboarding/etapas/nova')) return;
    if (rejectNonPdf(req.file, res, '/admin/portal/onboarding/etapas/nova')) return;
    try {
      const track = await getActiveTrack();
      if (!track) {
        return flashRedirect(res, '/admin/portal/onboarding', { erro: 'Nenhuma trilha ativa.' });
      }
      const fileRow = req.file ? await saveUploadedFile(req.file, req.hubUser.id) : null;
      await createStep(track.id, req.body, fileRow?.id || null);
      return flashRedirect(res, '/admin/portal/onboarding', { ok: 'criado' });
    } catch (e) {
      return flashRedirect(res, '/admin/portal/onboarding/etapas/nova', { erro: safeError(e) });
    }
  });
});

router.post('/admin/portal/onboarding/etapas/:id/excluir', requireHubAdmin, async (req, res) => {
  try {
    const existing = await getStep(req.params.id);
    if (!existing) return flashRedirect(res, '/admin/portal/onboarding', { erro: 'Etapa não encontrada.' });
    if (!isConfirmed(req.body)) {
      return res.redirect(`/admin/portal/onboarding?confirmar=${encodeURIComponent(req.params.id)}`);
    }
    await deleteStep(req.params.id);
    return flashRedirect(res, '/admin/portal/onboarding', { ok: 'excluido' });
  } catch (err) {
    return flashRedirect(res, '/admin/portal/onboarding', { erro: safeError(err) });
  }
});

router.post('/admin/portal/onboarding/etapas/:id', requireHubAdmin, (req, res) => {
  uploadDoc.single('pdf')(req, res, async (err) => {
    if (handleUploadError(err, res, `/admin/portal/onboarding/etapas/${req.params.id}/editar`)) return;
    try {
      if (req.file && String(req.file.mimetype || '').toLowerCase() !== 'application/pdf') {
        return flashRedirect(res, `/admin/portal/onboarding/etapas/${req.params.id}/editar`, {
          erro: 'Envie apenas PDF neste campo.',
        });
      }
      const fileRow = req.file ? await saveUploadedFile(req.file, req.hubUser.id) : null;
      await updateStep(req.params.id, req.body, fileRow?.id || null);
      return flashRedirect(res, '/admin/portal/onboarding', { ok: 'atualizado' });
    } catch (e) {
      return flashRedirect(res, `/admin/portal/onboarding/etapas/${req.params.id}/editar`, { erro: safeError(e) });
    }
  });
});

router.post('/admin/portal/onboarding/etapas/:id/mover', requireHubAdmin, async (req, res) => {
  try {
    await moveStep(req.params.id, req.body.direction === 'up' ? 'up' : 'down');
    return flashRedirect(res, '/admin/portal/onboarding', { ok: 'atualizado' });
  } catch (err) {
    return flashRedirect(res, '/admin/portal/onboarding', { erro: safeError(err) });
  }
});

router.get('/admin/portal/onboarding/acompanhamento', requireHubAdmin, async (req, res) => {
  const status = String(req.query.status || '').toUpperCase();
  const department = String(req.query.department || '').trim();
  const q = String(req.query.q || '').trim();
  const detailId = String(req.query.detalhe || '').trim();
  const users = await listOnboardingUsers({
    status: ['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(status) ? status : '',
    department,
    q,
  });
  let detail = null;
  if (detailId) {
    detail = await getUserOnboardingDetail(detailId);
  }
  return res.render('admin/portal-onboarding-users', {
    title: 'Acompanhamento — Onboarding',
    hubUser: req.hubUser,
    current: 'admin-onboarding-users',
    users,
    filterStatus: status || '',
    filterDepartment: department,
    filterQ: q,
    departments: CONTACT_DEPARTMENTS,
    detail,
    ...pickFlash(req),
  });
});

router.post('/admin/portal/onboarding/usuarios/:id/status', requireHubAdmin, async (req, res) => {
  try {
    await adminSetOnboardingStatus(req.params.id, req.body.status);
    return flashRedirect(res, '/admin/portal/onboarding/acompanhamento', { ok: 'status' });
  } catch (err) {
    return flashRedirect(res, '/admin/portal/onboarding/acompanhamento', { erro: safeError(err) });
  }
});

/* Legacy bookmark redirect */
router.get('/hub/modulo/organograma', requireHubAuth, (_req, res) => {
  return res.redirect('/portal/diagrama');
});

router.get('/hub/modulo/pops', requireHubAuth, (_req, res) => {
  return res.redirect('/portal/pops');
});

router.get('/hub/modulo/informativos', requireHubAuth, (_req, res) => {
  return res.redirect('/portal/informativos');
});

router.get('/hub/modulo/integracao', requireHubAuth, (_req, res) => {
  return res.redirect('/portal/onboarding');
});

router.get('/hub/modulo/documentos', requireHubAuth, (_req, res) => {
  return res.redirect('/portal/documentos');
});

module.exports = {
  router,
  loadHomeForRequest: async (hubUser) => {
    const home = await loadHome(hubUser.id);
    const needsOnboarding = hubUser.onboardingStatus !== 'COMPLETED';
    let onboardingProgress = null;
    if (needsOnboarding) {
      const data = await loadOnboardingForUser(hubUser);
      const percent = data.total > 0 ? Math.round((data.doneCount / data.total) * 100) : 0;
      onboardingProgress = {
        doneCount: data.doneCount,
        total: data.total,
        percent,
        trackName: data.track ? data.track.name : null,
      };
    }
    return {
      ...home,
      greeting: greetingForNow(hubUser.displayName || hubUser.username),
      needsOnboarding,
      onboardingProgress,
      contactDepartments: CONTACT_DEPARTMENTS,
    };
  },
  kindFromSlug,
};

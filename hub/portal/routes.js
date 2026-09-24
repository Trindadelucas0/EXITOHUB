'use strict';

const express = require('express');
const fs = require('fs');
const { requireHubAuth, requireHubAdmin } = require('../middleware');
const {
  loadHome,
  greetingForNow,
  listAnnouncements,
  listEvents,
  listLinks,
  getLink,
  createLink,
  updateLink,
  setLinkActive,
  listContacts,
  getContact,
  createContact,
  updateContact,
  setContactActive,
  listContents,
  getContent,
  createContent,
  updateContent,
  setContentPublished,
  kindMeta,
  kindFromSlug,
  listItems,
  getItem,
  createItem,
  updateItem,
  setItemActive,
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
  moveStep,
  listOnboardingUsers,
  getUserOnboardingDetail,
  adminSetOnboardingStatus,
  bodyFlag,
  LINK_CATEGORIES,
  CONTACT_DEPARTMENTS,
  ITEM_DEPARTMENTS,
  CONTENT_CATEGORIES,
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
  };
  return {
    flash: messages[flashKey] || null,
    error: req.query.erro ? String(req.query.erro).slice(0, 300) : null,
  };
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

router.get('/portal/eventos', requireHubAuth, async (req, res) => {
  const events = await listEvents({ activeOnly: true, upcomingOnly: true });
  return res.render('portal/placeholder', {
    title: 'Próximos eventos — EXITO HUB',
    hubUser: req.hubUser,
    current: 'portal-eventos',
    pageTitle: 'Próximos eventos',
    pageIcon: 'event_busy',
    pageLead: EMPTY_STATES.events,
    pageHint: EMPTY_STATES.eventsSupport,
    listKind: 'events',
    listItems: events,
  });
});

router.get('/portal/agenda', requireHubAuth, async (req, res) => {
  const events = await listEvents({ activeOnly: true, upcomingOnly: true });
  return res.render('portal/placeholder', {
    title: 'Agenda Êxito — EXITO HUB',
    hubUser: req.hubUser,
    current: 'portal-agenda',
    pageTitle: 'Agenda Êxito',
    pageIcon: 'calendar_month',
    pageLead: EMPTY_STATES.agenda,
    pageHint: EMPTY_STATES.agendaSupport,
    listKind: 'events',
    listItems: events,
  });
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

router.get('/admin/portal', requireHubAdmin, (req, res) => {
  return res.render('admin/portal-index', {
    title: 'Portal Corporativo — EXITO HUB',
    hubUser: req.hubUser,
    current: 'admin-portal',
    itemKinds: ITEM_KINDS,
    ...pickFlash(req),
  });
});

router.get('/admin/portal/configuracoes', requireHubAdmin, (req, res) => {
  return res.render('admin/portal-settings', {
    title: 'Configurações do Portal — EXITO HUB',
    hubUser: req.hubUser,
    current: 'admin-portal',
  });
});

/* ───────────── Admin Links ───────────── */

router.get('/admin/portal/links', requireHubAdmin, async (req, res) => {
  const links = await listLinks();
  return res.render('admin/portal-links', {
    title: 'Links Úteis — Portal',
    hubUser: req.hubUser,
    current: 'admin-portal',
    links,
    editing: null,
    categories: LINK_CATEGORIES,
    ...pickFlash(req),
  });
});

router.get('/admin/portal/links/novo', requireHubAdmin, async (req, res) => {
  const links = await listLinks();
  return res.render('admin/portal-links', {
    title: 'Novo link — Portal',
    hubUser: req.hubUser,
    current: 'admin-portal',
    links,
    editing: { id: null },
    categories: LINK_CATEGORIES,
    ...pickFlash(req),
  });
});

router.get('/admin/portal/links/:id/editar', requireHubAdmin, async (req, res) => {
  const editing = await getLink(req.params.id);
  if (!editing) return res.redirect('/admin/portal/links');
  const links = await listLinks();
  return res.render('admin/portal-links', {
    title: 'Editar link — Portal',
    hubUser: req.hubUser,
    current: 'admin-portal',
    links,
    editing,
    categories: LINK_CATEGORIES,
    ...pickFlash(req),
  });
});

router.post('/admin/portal/links', requireHubAdmin, async (req, res) => {
  try {
    await createLink(req.body);
    return flashRedirect(res, '/admin/portal/links', { ok: 'criado' });
  } catch (err) {
    return flashRedirect(res, '/admin/portal/links/novo', { erro: safeError(err) });
  }
});

router.post('/admin/portal/links/:id', requireHubAdmin, async (req, res) => {
  try {
    await updateLink(req.params.id, req.body);
    return flashRedirect(res, '/admin/portal/links', { ok: 'atualizado' });
  } catch (err) {
    return flashRedirect(res, `/admin/portal/links/${req.params.id}/editar`, { erro: safeError(err) });
  }
});

router.post('/admin/portal/links/:id/status', requireHubAdmin, async (req, res) => {
  try {
    await setLinkActive(req.params.id, bodyFlag(req.body.active));
    return flashRedirect(res, '/admin/portal/links', { ok: 'status' });
  } catch (err) {
    return flashRedirect(res, '/admin/portal/links', { erro: safeError(err) });
  }
});

/* ───────────── Admin Contacts ───────────── */

router.get('/admin/portal/contatos', requireHubAdmin, async (req, res) => {
  const contacts = await listContacts();
  return res.render('admin/portal-contacts', {
    title: 'Contatos Úteis — Portal',
    hubUser: req.hubUser,
    current: 'admin-portal',
    contacts,
    editing: null,
    departments: CONTACT_DEPARTMENTS,
    ...pickFlash(req),
  });
});

router.get('/admin/portal/contatos/novo', requireHubAdmin, async (req, res) => {
  const contacts = await listContacts();
  return res.render('admin/portal-contacts', {
    title: 'Novo contato — Portal',
    hubUser: req.hubUser,
    current: 'admin-portal',
    contacts,
    editing: { id: null },
    departments: CONTACT_DEPARTMENTS,
    ...pickFlash(req),
  });
});

router.get('/admin/portal/contatos/:id/editar', requireHubAdmin, async (req, res) => {
  const editing = await getContact(req.params.id);
  if (!editing) return res.redirect('/admin/portal/contatos');
  const contacts = await listContacts();
  return res.render('admin/portal-contacts', {
    title: 'Editar contato — Portal',
    hubUser: req.hubUser,
    current: 'admin-portal',
    contacts,
    editing,
    departments: CONTACT_DEPARTMENTS,
    ...pickFlash(req),
  });
});

router.post('/admin/portal/contatos', requireHubAdmin, (req, res) => {
  uploadImage.single('photo')(req, res, async (err) => {
    if (handleUploadError(err, res, '/admin/portal/contatos/novo')) return;
    try {
      const fileRow = req.file ? await saveUploadedFile(req.file, req.hubUser.id) : null;
      await createContact(req.body, fileRow?.id || null);
      return flashRedirect(res, '/admin/portal/contatos', { ok: 'criado' });
    } catch (e) {
      return flashRedirect(res, '/admin/portal/contatos/novo', { erro: safeError(e) });
    }
  });
});

router.post('/admin/portal/contatos/:id', requireHubAdmin, (req, res) => {
  uploadImage.single('photo')(req, res, async (err) => {
    if (handleUploadError(err, res, `/admin/portal/contatos/${req.params.id}/editar`)) return;
    try {
      const fileRow = req.file ? await saveUploadedFile(req.file, req.hubUser.id) : null;
      await updateContact(req.params.id, req.body, fileRow?.id || null);
      return flashRedirect(res, '/admin/portal/contatos', { ok: 'atualizado' });
    } catch (e) {
      return flashRedirect(res, `/admin/portal/contatos/${req.params.id}/editar`, { erro: safeError(e) });
    }
  });
});

router.post('/admin/portal/contatos/:id/status', requireHubAdmin, async (req, res) => {
  try {
    await setContactActive(req.params.id, bodyFlag(req.body.active));
    return flashRedirect(res, '/admin/portal/contatos', { ok: 'status' });
  } catch (err) {
    return flashRedirect(res, '/admin/portal/contatos', { erro: safeError(err) });
  }
});

/* ───────────── Admin Contents ───────────── */

router.get('/admin/portal/conteudos', requireHubAdmin, async (req, res) => {
  const contents = await listContents();
  return res.render('admin/portal-contents', {
    title: 'Conteúdos Êxito — Portal',
    hubUser: req.hubUser,
    current: 'admin-portal',
    contents,
    editing: null,
    categories: CONTENT_CATEGORIES,
    targetTypes: TARGET_TYPES,
    ...pickFlash(req),
  });
});

router.get('/admin/portal/conteudos/novo', requireHubAdmin, async (req, res) => {
  const contents = await listContents();
  return res.render('admin/portal-contents', {
    title: 'Novo conteúdo — Portal',
    hubUser: req.hubUser,
    current: 'admin-portal',
    contents,
    editing: { id: null },
    categories: CONTENT_CATEGORIES,
    targetTypes: TARGET_TYPES,
    ...pickFlash(req),
  });
});

router.get('/admin/portal/conteudos/:id/editar', requireHubAdmin, async (req, res) => {
  const editing = await getContent(req.params.id);
  if (!editing) return res.redirect('/admin/portal/conteudos');
  const contents = await listContents();
  return res.render('admin/portal-contents', {
    title: 'Editar conteúdo — Portal',
    hubUser: req.hubUser,
    current: 'admin-portal',
    contents,
    editing,
    categories: CONTENT_CATEGORIES,
    targetTypes: TARGET_TYPES,
    ...pickFlash(req),
  });
});

router.post('/admin/portal/conteudos', requireHubAdmin, (req, res) => {
  uploadImage.single('image')(req, res, async (err) => {
    if (handleUploadError(err, res, '/admin/portal/conteudos/novo')) return;
    try {
      const fileRow = req.file ? await saveUploadedFile(req.file, req.hubUser.id) : null;
      await createContent(req.body, fileRow?.id || null);
      return flashRedirect(res, '/admin/portal/conteudos', { ok: 'criado' });
    } catch (e) {
      return flashRedirect(res, '/admin/portal/conteudos/novo', { erro: safeError(e) });
    }
  });
});

router.post('/admin/portal/conteudos/:id', requireHubAdmin, (req, res) => {
  uploadImage.single('image')(req, res, async (err) => {
    if (handleUploadError(err, res, `/admin/portal/conteudos/${req.params.id}/editar`)) return;
    try {
      const fileRow = req.file ? await saveUploadedFile(req.file, req.hubUser.id) : null;
      await updateContent(req.params.id, req.body, fileRow?.id || null);
      return flashRedirect(res, '/admin/portal/conteudos', { ok: 'atualizado' });
    } catch (e) {
      return flashRedirect(res, `/admin/portal/conteudos/${req.params.id}/editar`, { erro: safeError(e) });
    }
  });
});

router.post('/admin/portal/conteudos/:id/status', requireHubAdmin, async (req, res) => {
  try {
    await setContentPublished(req.params.id, bodyFlag(req.body.active));
    return flashRedirect(res, '/admin/portal/conteudos', { ok: 'status' });
  } catch (err) {
    return flashRedirect(res, '/admin/portal/conteudos', { erro: safeError(err) });
  }
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

function renderItemsAdmin(res, { kind, meta, items, editing, flash, error, hubUser }) {
  return res.render('admin/portal-items', {
    title: editing && editing.id ? `Editar — ${meta.label}` : (editing ? `Novo — ${meta.label}` : `${meta.label} — Portal`),
    hubUser,
    current: 'admin-portal',
    kind,
    meta,
    items,
    editing,
    departments: ITEM_DEPARTMENTS,
    flash: flash || null,
    error: error || null,
  });
}

router.get('/admin/portal/itens/:kind', requireHubAdmin, async (req, res) => {
  const kind = req.params.kind;
  const meta = kindMeta(kind);
  if (!meta) return res.status(404).send('Tipo não encontrado');
  const items = await listItems(kind);
  return renderItemsAdmin(res, {
    kind,
    meta,
    items,
    editing: null,
    hubUser: req.hubUser,
    ...pickFlash(req),
  });
});

router.get('/admin/portal/itens/:kind/novo', requireHubAdmin, async (req, res) => {
  const kind = req.params.kind;
  const meta = kindMeta(kind);
  if (!meta) return res.status(404).send('Tipo não encontrado');
  const items = await listItems(kind);
  return renderItemsAdmin(res, {
    kind,
    meta,
    items,
    editing: { id: null },
    hubUser: req.hubUser,
    ...pickFlash(req),
  });
});

router.get('/admin/portal/itens/:kind/:id/editar', requireHubAdmin, async (req, res) => {
  const kind = req.params.kind;
  const meta = kindMeta(kind);
  if (!meta) return res.status(404).send('Tipo não encontrado');
  const editing = await getItem(req.params.id);
  if (!editing || editing.kind !== kind) return res.redirect(`/admin/portal/itens/${kind}`);
  const items = await listItems(kind);
  return renderItemsAdmin(res, {
    kind,
    meta,
    items,
    editing,
    hubUser: req.hubUser,
    ...pickFlash(req),
  });
});

router.post('/admin/portal/itens/:kind', requireHubAdmin, (req, res) => {
  const kind = req.params.kind;
  const meta = kindMeta(kind);
  if (!meta) return res.status(404).send('Tipo não encontrado');
  itemUploadFields(kind)(req, res, async (err) => {
    if (handleUploadError(err, res, `/admin/portal/itens/${kind}/novo`)) return;
    try {
      const { fileId, thumbnailId } = await saveItemUploads(req);
      await createItem(kind, req.body, fileId, thumbnailId);
      return flashRedirect(res, `/admin/portal/itens/${kind}`, { ok: 'criado' });
    } catch (e) {
      return flashRedirect(res, `/admin/portal/itens/${kind}/novo`, { erro: safeError(e) });
    }
  });
});

router.post('/admin/portal/itens/:kind/:id', requireHubAdmin, (req, res) => {
  const kind = req.params.kind;
  const meta = kindMeta(kind);
  if (!meta) return res.status(404).send('Tipo não encontrado');
  itemUploadFields(kind)(req, res, async (err) => {
    if (handleUploadError(err, res, `/admin/portal/itens/${kind}/${req.params.id}/editar`)) return;
    try {
      const { fileId, thumbnailId } = await saveItemUploads(req);
      await updateItem(req.params.id, req.body, fileId, thumbnailId);
      return flashRedirect(res, `/admin/portal/itens/${kind}`, { ok: 'atualizado' });
    } catch (e) {
      return flashRedirect(res, `/admin/portal/itens/${kind}/${req.params.id}/editar`, { erro: safeError(e) });
    }
  });
});

router.post('/admin/portal/itens/:kind/:id/status', requireHubAdmin, async (req, res) => {
  const kind = req.params.kind;
  try {
    await setItemActive(req.params.id, bodyFlag(req.body.active));
    return flashRedirect(res, `/admin/portal/itens/${kind}`, { ok: 'status' });
  } catch (err) {
    return flashRedirect(res, `/admin/portal/itens/${kind}`, { erro: safeError(err) });
  }
});

/* ───────────── Admin Onboarding ───────────── */

router.get('/admin/portal/onboarding', requireHubAdmin, async (req, res) => {
  const track = await getActiveTrack();
  const steps = track ? await listSteps(track.id) : [];
  return res.render('admin/portal-onboarding', {
    title: 'Onboarding — Portal',
    hubUser: req.hubUser,
    current: 'admin-portal',
    track,
    steps,
    editingStep: null,
    ...pickFlash(req),
  });
});

router.get('/admin/portal/onboarding/etapas/:id/editar', requireHubAdmin, async (req, res) => {
  const track = await getActiveTrack();
  const steps = track ? await listSteps(track.id) : [];
  const editingStep = steps.find((s) => String(s.id) === String(req.params.id)) || null;
  if (!editingStep) return res.redirect('/admin/portal/onboarding');
  return res.render('admin/portal-onboarding', {
    title: 'Editar etapa — Portal',
    hubUser: req.hubUser,
    current: 'admin-portal',
    track,
    steps,
    editingStep,
    ...pickFlash(req),
  });
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
    const home = await loadHome();
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

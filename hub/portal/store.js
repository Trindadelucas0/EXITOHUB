'use strict';

const { query } = require('../db');
const { setOnboardingStatus } = require('../auth');
const { mediaUrl } = require('./upload');
const {
  LINK_CATEGORIES,
  CONTACT_DEPARTMENTS,
  ITEM_DEPARTMENTS,
  CONTENT_CATEGORIES,
  ITEM_KINDS,
  HOME_INTEGRATION_KINDS,
  TARGET_TYPES,
  ONBOARDING_STATUSES,
  IMAGE_MIMES,
  EMPTY_STATES,
} = require('./constants');

function trimStr(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function bodyFlag(value) {
  if (Array.isArray(value)) value = value[value.length - 1];
  return value === '1' || value === 'on' || value === true;
}

function parseSortOrder(value, fallback = 0) {
  const n = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-9999, Math.min(9999, n));
}

function assertHttpsUrl(raw, field = 'URL') {
  const url = trimStr(raw, 2000);
  if (!url) throw Object.assign(new Error(`${field} é obrigatória.`), { status: 400 });
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    throw Object.assign(new Error(`${field} inválida.`), { status: 400 });
  }
  if (parsed.protocol !== 'https:') {
    throw Object.assign(new Error(`${field} deve usar https.`), { status: 400 });
  }
  return parsed.href;
}

function assertOptionalHttpsUrl(raw) {
  const url = trimStr(raw, 2000);
  if (!url) return null;
  return assertHttpsUrl(url);
}

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Aceita watch / youtu.be / embed / shorts. Retorna watch canônico + embed nocookie.
 */
function parseYoutubeEmbed(raw) {
  const href = assertHttpsUrl(raw, 'Link do YouTube');
  let parsed;
  try {
    parsed = new URL(href);
  } catch (_) {
    throw Object.assign(new Error('Link do YouTube inválido.'), { status: 400 });
  }
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  let videoId = null;

  if (host === 'youtu.be') {
    videoId = parsed.pathname.split('/').filter(Boolean)[0] || null;
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v');
    } else {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'v') {
        videoId = parts[1] || null;
      }
    }
  } else {
    throw Object.assign(new Error('Use um link do YouTube (youtube.com ou youtu.be).'), { status: 400 });
  }

  if (!videoId || !YOUTUBE_ID_RE.test(videoId)) {
    throw Object.assign(new Error('Não foi possível identificar o vídeo do YouTube.'), { status: 400 });
  }

  return {
    videoId,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
  };
}

function assertInternalRoute(raw) {
  const route = trimStr(raw, 300);
  if (!route) return null;
  if (!route.startsWith('/portal/') && !route.startsWith('/admin/') && route !== '/') {
    throw Object.assign(new Error('Rota interna inválida.'), { status: 400 });
  }
  if (route.includes('://') || route.includes('\\') || route.includes('..')) {
    throw Object.assign(new Error('Rota interna inválida.'), { status: 400 });
  }
  return route;
}

function digitsOnly(value, max = 20) {
  return String(value || '').replace(/\D/g, '').slice(0, max);
}

function mapFileFields(row, idKey, urlKey) {
  if (!row) return row;
  const id = row[idKey];
  return {
    ...row,
    [urlKey]: id ? mediaUrl(id) : null,
  };
}

/* ───────────── Home ───────────── */

async function loadHome() {
  const [links, contacts, contents] = await Promise.all([
    listLinks({ homeOnly: true, activeOnly: true }),
    listContacts({ homeOnly: true, activeOnly: true }),
    listContents({ homeOnly: true, publishedOnly: true }),
  ]);
  const integrationCards = HOME_INTEGRATION_KINDS.map((kind) => ({
    kind,
    ...ITEM_KINDS[kind],
  }));
  const quickCards = Object.entries(ITEM_KINDS).map(([kind, meta]) => ({ kind, ...meta }));
  return {
    cards: integrationCards,
    quickCards,
    links,
    contacts,
    contents,
    emptyStates: EMPTY_STATES,
  };
}

function greetingForNow(displayName) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
  );
  let greet = 'Bom dia';
  if (hour >= 12 && hour < 18) greet = 'Boa tarde';
  if (hour >= 18 || hour < 5) greet = 'Boa noite';
  return `${greet}, ${displayName || 'bem-vindo'}.`;
}

/* ───────────── Links ───────────── */

async function listLinks({ homeOnly = false, activeOnly = false } = {}) {
  const clauses = [];
  if (activeOnly) clauses.push('is_active = true');
  if (homeOnly) clauses.push('show_on_home = true');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT id, name, description, url, category, icon, is_active, show_on_home, sort_order, created_at, updated_at
     FROM portal_links ${where}
     ORDER BY sort_order ASC, name ASC`,
  );
  return result.rows;
}

async function getLink(id) {
  const result = await query(
    `SELECT id, name, description, url, category, icon, is_active, show_on_home, sort_order, created_at, updated_at
     FROM portal_links WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

function parseLinkBody(body) {
  const name = trimStr(body.name, 120);
  if (!name) throw Object.assign(new Error('Nome do link é obrigatório.'), { status: 400 });
  const category = trimStr(body.category, 60) || 'Outros';
  if (!LINK_CATEGORIES.includes(category)) {
    throw Object.assign(new Error('Categoria inválida.'), { status: 400 });
  }
  return {
    name,
    description: trimStr(body.description, 500) || null,
    url: assertHttpsUrl(body.url),
    category,
    icon: trimStr(body.icon, 40) || null,
    is_active: bodyFlag(body.is_active),
    show_on_home: bodyFlag(body.show_on_home),
    sort_order: parseSortOrder(body.sort_order, 0),
  };
}

async function createLink(body) {
  const data = parseLinkBody(body);
  const result = await query(
    `INSERT INTO portal_links (name, description, url, category, icon, is_active, show_on_home, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [data.name, data.description, data.url, data.category, data.icon, data.is_active, data.show_on_home, data.sort_order],
  );
  return getLink(result.rows[0].id);
}

async function updateLink(id, body) {
  const existing = await getLink(id);
  if (!existing) return null;
  const data = parseLinkBody({
    name: body.name ?? existing.name,
    description: body.description ?? existing.description,
    url: body.url ?? existing.url,
    category: body.category ?? existing.category,
    icon: body.icon ?? existing.icon,
    sort_order: body.sort_order ?? existing.sort_order,
    is_active: body.is_active,
    show_on_home: body.show_on_home,
  });
  await query(
    `UPDATE portal_links SET
      name=$1, description=$2, url=$3, category=$4, icon=$5,
      is_active=$6, show_on_home=$7, sort_order=$8, updated_at=NOW()
     WHERE id=$9`,
    [data.name, data.description, data.url, data.category, data.icon, data.is_active, data.show_on_home, data.sort_order, id],
  );
  return getLink(id);
}

async function setLinkActive(id, active) {
  await query('UPDATE portal_links SET is_active = $1, updated_at = NOW() WHERE id = $2', [Boolean(active), id]);
  return getLink(id);
}

/* ───────────── Contacts ───────────── */

async function listContacts({ homeOnly = false, activeOnly = false, department = '' } = {}) {
  const clauses = [];
  const params = [];
  if (activeOnly) clauses.push('c.is_active = true');
  if (homeOnly) clauses.push('c.show_on_home = true');
  if (department) {
    params.push(department);
    clauses.push(`c.department = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT c.id, c.name, c.role, c.department, c.email, c.phone, c.whatsapp, c.description,
            c.photo_file_id, c.is_active, c.show_on_home, c.sort_order, c.created_at, c.updated_at
     FROM portal_contacts c ${where}
     ORDER BY c.sort_order ASC, c.name ASC`,
    params,
  );
  return result.rows.map((row) => mapFileFields(row, 'photo_file_id', 'photo_url'));
}

async function getContact(id) {
  const result = await query(
    `SELECT id, name, role, department, email, phone, whatsapp, description,
            photo_file_id, is_active, show_on_home, sort_order, created_at, updated_at
     FROM portal_contacts WHERE id = $1 LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  return row ? mapFileFields(row, 'photo_file_id', 'photo_url') : null;
}

function parseContactBody(body, photoFileId) {
  const name = trimStr(body.name, 120);
  if (!name) throw Object.assign(new Error('Nome é obrigatório.'), { status: 400 });
  const department = trimStr(body.department, 60) || 'Outros';
  if (!CONTACT_DEPARTMENTS.includes(department)) {
    throw Object.assign(new Error('Departamento inválido.'), { status: 400 });
  }
  const email = trimStr(body.email, 200).toLowerCase();
  if (email && !email.includes('@')) {
    throw Object.assign(new Error('E-mail inválido.'), { status: 400 });
  }
  const whatsapp = digitsOnly(body.whatsapp, 15);
  return {
    name,
    role: trimStr(body.role, 120) || null,
    department,
    email: email || null,
    phone: trimStr(body.phone, 40) || null,
    whatsapp: whatsapp || null,
    description: trimStr(body.description, 1000) || null,
    photo_file_id: photoFileId || null,
    is_active: bodyFlag(body.is_active),
    show_on_home: bodyFlag(body.show_on_home),
    sort_order: parseSortOrder(body.sort_order, 0),
  };
}

async function createContact(body, photoFileId) {
  const data = parseContactBody(body, photoFileId);
  const result = await query(
    `INSERT INTO portal_contacts
      (name, role, department, email, phone, whatsapp, description, photo_file_id, is_active, show_on_home, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      data.name, data.role, data.department, data.email, data.phone, data.whatsapp,
      data.description, data.photo_file_id, data.is_active, data.show_on_home, data.sort_order,
    ],
  );
  return getContact(result.rows[0].id);
}

async function updateContact(id, body, photoFileId) {
  const existing = await getContact(id);
  if (!existing) return null;
  const nextPhoto = photoFileId || existing.photo_file_id || null;
  const data = parseContactBody(
    {
      name: body.name ?? existing.name,
      role: body.role ?? existing.role,
      department: body.department ?? existing.department,
      email: body.email ?? existing.email,
      phone: body.phone ?? existing.phone,
      whatsapp: body.whatsapp ?? existing.whatsapp,
      description: body.description ?? existing.description,
      sort_order: body.sort_order ?? existing.sort_order,
      is_active: body.is_active,
      show_on_home: body.show_on_home,
    },
    nextPhoto,
  );
  await query(
    `UPDATE portal_contacts SET
      name=$1, role=$2, department=$3, email=$4, phone=$5, whatsapp=$6, description=$7,
      photo_file_id=$8, is_active=$9, show_on_home=$10, sort_order=$11, updated_at=NOW()
     WHERE id=$12`,
    [
      data.name, data.role, data.department, data.email, data.phone, data.whatsapp,
      data.description, data.photo_file_id, data.is_active, data.show_on_home, data.sort_order, id,
    ],
  );
  return getContact(id);
}

async function setContactActive(id, active) {
  await query('UPDATE portal_contacts SET is_active = $1, updated_at = NOW() WHERE id = $2', [Boolean(active), id]);
  return getContact(id);
}

/* ───────────── Contents (carousel) ───────────── */

async function listContents({ homeOnly = false, publishedOnly = false } = {}) {
  const clauses = [];
  if (publishedOnly) clauses.push('is_published = true');
  if (homeOnly) clauses.push('show_on_home = true');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT id, title, description, image_file_id, category, target_type, target_url, target_route,
            is_published, show_on_home, sort_order, published_at, created_at, updated_at
     FROM portal_contents ${where}
     ORDER BY sort_order ASC, published_at DESC NULLS LAST, created_at DESC`,
  );
  return result.rows.map((row) => {
    const mapped = mapFileFields(row, 'image_file_id', 'image_url');
    mapped.href = contentHref(mapped);
    return mapped;
  });
}

function contentHref(row) {
  if (row.target_type === 'external' && row.target_url) return row.target_url;
  if (row.target_type === 'internal' && row.target_route) return row.target_route;
  return null;
}

async function getContent(id) {
  const result = await query(
    `SELECT id, title, description, image_file_id, category, target_type, target_url, target_route,
            is_published, show_on_home, sort_order, published_at, created_at, updated_at
     FROM portal_contents WHERE id = $1 LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  const mapped = mapFileFields(row, 'image_file_id', 'image_url');
  mapped.href = contentHref(mapped);
  return mapped;
}

function parseContentBody(body, imageFileId) {
  const title = trimStr(body.title, 160);
  if (!title) throw Object.assign(new Error('Título é obrigatório.'), { status: 400 });
  const category = trimStr(body.category, 60) || 'Empresa';
  if (!CONTENT_CATEGORIES.includes(category)) {
    throw Object.assign(new Error('Categoria inválida.'), { status: 400 });
  }
  const target_type = trimStr(body.target_type, 20) || 'none';
  if (!TARGET_TYPES.includes(target_type)) {
    throw Object.assign(new Error('Destino inválido.'), { status: 400 });
  }
  let target_url = null;
  let target_route = null;
  if (target_type === 'external') target_url = assertHttpsUrl(body.target_url, 'URL de destino');
  if (target_type === 'internal') {
    target_route = assertInternalRoute(body.target_route);
    if (!target_route) throw Object.assign(new Error('Página interna é obrigatória.'), { status: 400 });
  }
  const is_published = bodyFlag(body.is_published ?? body.publicado);
  return {
    title,
    description: trimStr(body.description, 1000) || null,
    image_file_id: imageFileId || null,
    category,
    target_type,
    target_url,
    target_route,
    is_published,
    show_on_home: bodyFlag(body.show_on_home),
    sort_order: parseSortOrder(body.sort_order, 0),
  };
}

async function createContent(body, imageFileId) {
  const data = parseContentBody(body, imageFileId);
  if (!data.image_file_id) {
    throw Object.assign(new Error('Imagem é obrigatória.'), { status: 400 });
  }
  const result = await query(
    `INSERT INTO portal_contents
      (title, description, image_file_id, category, target_type, target_url, target_route,
       is_published, show_on_home, sort_order, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CASE WHEN $8 THEN NOW() ELSE NULL END)
     RETURNING id`,
    [
      data.title, data.description, data.image_file_id, data.category, data.target_type,
      data.target_url, data.target_route, data.is_published, data.show_on_home, data.sort_order,
    ],
  );
  return getContent(result.rows[0].id);
}

async function updateContent(id, body, imageFileId) {
  const existing = await getContent(id);
  if (!existing) return null;
  const nextImage = imageFileId || existing.image_file_id;
  const data = parseContentBody(
    {
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
      category: body.category ?? existing.category,
      target_type: body.target_type ?? existing.target_type,
      target_url: body.target_url ?? existing.target_url,
      target_route: body.target_route ?? existing.target_route,
      sort_order: body.sort_order ?? existing.sort_order,
      is_published: body.is_published,
      show_on_home: body.show_on_home,
    },
    nextImage,
  );
  if (!data.image_file_id) {
    throw Object.assign(new Error('Imagem é obrigatória.'), { status: 400 });
  }
  await query(
    `UPDATE portal_contents SET
      title=$1, description=$2, image_file_id=$3, category=$4, target_type=$5,
      target_url=$6, target_route=$7, is_published=$8, show_on_home=$9, sort_order=$10,
      published_at = CASE
        WHEN $8 AND published_at IS NULL THEN NOW()
        WHEN NOT $8 THEN NULL
        ELSE published_at
      END,
      updated_at=NOW()
     WHERE id=$11`,
    [
      data.title, data.description, data.image_file_id, data.category, data.target_type,
      data.target_url, data.target_route, data.is_published, data.show_on_home, data.sort_order, id,
    ],
  );
  return getContent(id);
}

async function setContentPublished(id, published) {
  await query(
    `UPDATE portal_contents SET
      is_published = $1,
      published_at = CASE WHEN $1 THEN COALESCE(published_at, NOW()) ELSE NULL END,
      updated_at = NOW()
     WHERE id = $2`,
    [Boolean(published), id],
  );
  return getContent(id);
}

/* ───────────── Items (6 kinds) ───────────── */

function kindMeta(kind) {
  return ITEM_KINDS[kind] || null;
}

function kindFromSlug(slug) {
  const entry = Object.entries(ITEM_KINDS).find(([, meta]) => meta.slug === slug);
  return entry ? entry[0] : null;
}

function decorateItem(row) {
  if (!row) return null;
  const mapped = mapFileFields(row, 'file_id', 'file_url');
  const withThumb = mapFileFields(mapped, 'thumbnail_file_id', 'thumbnail_url');
  const mime = String(row.file_mime || '').toLowerCase();
  const thumbMime = String(row.thumbnail_mime || '').toLowerCase();
  const isImage = IMAGE_MIMES.has(mime);
  const meta = ITEM_KINDS[withThumb.kind] || {};
  let cover_url = meta.cover || null;
  if (withThumb.thumbnail_url && (IMAGE_MIMES.has(thumbMime) || !thumbMime)) {
    cover_url = withThumb.thumbnail_url;
  } else if (isImage && withThumb.file_url) {
    cover_url = withThumb.file_url;
  }

  let youtube_id = null;
  let youtube_embed_url = null;
  let href = withThumb.file_url || withThumb.external_url || null;

  if (withThumb.kind === 'video' && withThumb.external_url) {
    try {
      const yt = parseYoutubeEmbed(withThumb.external_url);
      youtube_id = yt.videoId;
      youtube_embed_url = yt.embedUrl;
      href = yt.watchUrl;
      if (!withThumb.thumbnail_url) {
        cover_url = `https://i.ytimg.com/vi/${yt.videoId}/hqdefault.jpg`;
      }
    } catch (_) {
      /* URL antiga inválida: não quebra a listagem */
    }
  }

  return {
    ...withThumb,
    file_mime: mime || null,
    is_image: isImage,
    href,
    cover_url,
    youtube_id,
    youtube_embed_url,
  };
}

async function listItems(kind, { activeOnly = false } = {}) {
  if (!ITEM_KINDS[kind]) throw Object.assign(new Error('Tipo inválido.'), { status: 400 });
  const clauses = ['i.kind = $1'];
  if (activeOnly) clauses.push('i.is_active = true');
  const result = await query(
    `SELECT i.id, i.kind, i.title, i.description, i.body, i.category, i.department, i.version,
            i.file_id, i.thumbnail_file_id, i.external_url, i.is_onboarding_required, i.is_active,
            i.sort_order, i.created_at, i.updated_at,
            f.mime AS file_mime, tf.mime AS thumbnail_mime
     FROM portal_items i
     LEFT JOIN portal_files f ON f.id = i.file_id
     LEFT JOIN portal_files tf ON tf.id = i.thumbnail_file_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY i.sort_order ASC, i.title ASC`,
    [kind],
  );
  return result.rows.map(decorateItem);
}

async function getItem(id) {
  const result = await query(
    `SELECT i.id, i.kind, i.title, i.description, i.body, i.category, i.department, i.version,
            i.file_id, i.thumbnail_file_id, i.external_url, i.is_onboarding_required, i.is_active,
            i.sort_order, i.created_at, i.updated_at,
            f.mime AS file_mime, tf.mime AS thumbnail_mime
     FROM portal_items i
     LEFT JOIN portal_files f ON f.id = i.file_id
     LEFT JOIN portal_files tf ON tf.id = i.thumbnail_file_id
     WHERE i.id = $1 LIMIT 1`,
    [id],
  );
  return decorateItem(result.rows[0]);
}

function parseItemBody(body, kind, fileId, thumbnailFileId) {
  if (!ITEM_KINDS[kind]) throw Object.assign(new Error('Tipo inválido.'), { status: 400 });
  const title = trimStr(body.title, 200);
  if (!title) throw Object.assign(new Error('Título é obrigatório.'), { status: 400 });
  let department = trimStr(body.department, 60) || null;
  if (department && !ITEM_DEPARTMENTS.includes(department)) {
    throw Object.assign(new Error('Departamento inválido.'), { status: 400 });
  }

  let external_url = null;
  let file_id = fileId || null;
  if (kind === 'video') {
    const yt = parseYoutubeEmbed(body.external_url);
    external_url = yt.watchUrl;
    file_id = null;
  } else {
    external_url = assertOptionalHttpsUrl(body.external_url);
  }

  return {
    kind,
    title,
    description: trimStr(body.description, 1000) || null,
    body: trimStr(body.body, 20000) || null,
    category: trimStr(body.category, 80) || null,
    department,
    version: trimStr(body.version, 40) || null,
    file_id,
    thumbnail_file_id: thumbnailFileId || null,
    external_url,
    is_onboarding_required: bodyFlag(body.is_onboarding_required),
    is_active: bodyFlag(body.is_active),
    sort_order: parseSortOrder(body.sort_order, 0),
  };
}

async function createItem(kind, body, fileId, thumbnailFileId) {
  const data = parseItemBody(body, kind, fileId, thumbnailFileId);
  const result = await query(
    `INSERT INTO portal_items
      (kind, title, description, body, category, department, version, file_id, thumbnail_file_id,
       external_url, is_onboarding_required, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      data.kind, data.title, data.description, data.body, data.category, data.department, data.version,
      data.file_id, data.thumbnail_file_id, data.external_url, data.is_onboarding_required,
      data.is_active, data.sort_order,
    ],
  );
  return getItem(result.rows[0].id);
}

async function updateItem(id, body, fileId, thumbnailFileId) {
  const existing = await getItem(id);
  if (!existing) return null;
  const nextFile = existing.kind === 'video'
    ? null
    : (fileId || existing.file_id || null);
  const nextThumb = thumbnailFileId || existing.thumbnail_file_id || null;
  const data = parseItemBody(
    {
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
      body: body.body ?? existing.body,
      category: body.category ?? existing.category,
      department: body.department ?? existing.department,
      version: body.version ?? existing.version,
      external_url: body.external_url ?? existing.external_url,
      sort_order: body.sort_order ?? existing.sort_order,
      is_active: body.is_active,
      is_onboarding_required: body.is_onboarding_required,
    },
    existing.kind,
    nextFile,
    nextThumb,
  );
  await query(
    `UPDATE portal_items SET
      title=$1, description=$2, body=$3, category=$4, department=$5, version=$6,
      file_id=$7, thumbnail_file_id=$8, external_url=$9, is_onboarding_required=$10,
      is_active=$11, sort_order=$12, updated_at=NOW()
     WHERE id=$13`,
    [
      data.title, data.description, data.body, data.category, data.department, data.version,
      data.file_id, data.thumbnail_file_id, data.external_url, data.is_onboarding_required,
      data.is_active, data.sort_order, id,
    ],
  );
  return getItem(id);
}

async function setItemActive(id, active) {
  await query('UPDATE portal_items SET is_active = $1, updated_at = NOW() WHERE id = $2', [Boolean(active), id]);
  return getItem(id);
}

/* ───────────── Onboarding ───────────── */

async function getActiveTrack() {
  const result = await query(
    `SELECT id, name, department, is_active, created_at, updated_at
     FROM onboarding_tracks WHERE is_active = true
     ORDER BY created_at ASC LIMIT 1`,
  );
  return result.rows[0] || null;
}

async function listTracks() {
  const result = await query(
    `SELECT id, name, department, is_active, created_at, updated_at FROM onboarding_tracks ORDER BY created_at ASC`,
  );
  return result.rows;
}

async function listSteps(trackId) {
  const result = await query(
    `SELECT id, track_id, position, title, description, target_kind, target_id, target_route, is_active, created_at, updated_at
     FROM onboarding_steps WHERE track_id = $1
     ORDER BY position ASC`,
    [trackId],
  );
  return result.rows;
}

async function getStep(id) {
  const result = await query(
    `SELECT id, track_id, position, title, description, target_kind, target_id, target_route, is_active, created_at, updated_at
     FROM onboarding_steps WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

async function listUserProgress(userId, trackId) {
  const result = await query(
    `SELECT p.step_id, p.completed_at
     FROM onboarding_user_progress p
     JOIN onboarding_steps s ON s.id = p.step_id
     WHERE p.user_id = $1 AND s.track_id = $2`,
    [userId, trackId],
  );
  return new Map(result.rows.map((r) => [r.step_id, r.completed_at]));
}

function stepHref(step) {
  if (step.target_kind === 'route' && step.target_route) return step.target_route;
  return null;
}

async function loadOnboardingForUser(user) {
  const track = await getActiveTrack();
  if (!track) {
    return { track: null, steps: [], doneCount: 0, total: 0, canComplete: false };
  }
  const steps = (await listSteps(track.id)).filter((s) => s.is_active);
  const progress = await listUserProgress(user.id, track.id);
  const enriched = steps.map((step, index) => {
    const done = progress.has(step.id);
    const prevDone = index === 0 || progress.has(steps[index - 1].id);
    return {
      ...step,
      href: stepHref(step),
      completed: done,
      unlocked: done || prevDone || user.onboardingStatus === 'COMPLETED',
    };
  });
  const doneCount = enriched.filter((s) => s.completed).length;
  return {
    track,
    steps: enriched,
    doneCount,
    total: enriched.length,
    canComplete: enriched.length > 0 && doneCount === enriched.length,
  };
}

async function startOnboarding(userId) {
  const row = await query(
    `SELECT onboarding_status FROM hub_users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const status = row.rows[0]?.onboarding_status;
  if (status === 'PENDING') {
    await setOnboardingStatus(userId, 'IN_PROGRESS');
  }
  return status === 'PENDING' ? 'IN_PROGRESS' : status;
}

async function completeStep(userId, stepId) {
  const step = await getStep(stepId);
  if (!step || !step.is_active) {
    throw Object.assign(new Error('Etapa não encontrada.'), { status: 404 });
  }
  await startOnboarding(userId);
  await query(
    `INSERT INTO onboarding_user_progress (user_id, step_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, stepId],
  );
  return true;
}

async function completeOnboarding(userId) {
  const userRow = await query(
    `SELECT id, display_name, onboarding_status FROM hub_users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const user = userRow.rows[0];
  if (!user) throw Object.assign(new Error('Usuário não encontrado.'), { status: 404 });
  const data = await loadOnboardingForUser({
    id: userId,
    onboardingStatus: user.onboarding_status,
  });
  if (!data.canComplete) {
    throw Object.assign(new Error('Conclua todas as etapas antes de finalizar.'), { status: 400 });
  }
  await setOnboardingStatus(userId, 'COMPLETED');
  return true;
}

async function updateStep(id, body) {
  const existing = await getStep(id);
  if (!existing) return null;
  const title = trimStr(body.title, 200) || existing.title;
  const description = trimStr(body.description, 1000) || null;
  const target_kind = trimStr(body.target_kind, 20) || existing.target_kind;
  if (!['item', 'content', 'route', 'none'].includes(target_kind)) {
    throw Object.assign(new Error('Destino da etapa inválido.'), { status: 400 });
  }
  const target_route = target_kind === 'route' ? assertInternalRoute(body.target_route) : null;
  const position = parseSortOrder(body.position, existing.position);
  const is_active = Object.prototype.hasOwnProperty.call(body, 'is_active')
    ? bodyFlag(body.is_active)
    : existing.is_active;
  await query(
    `UPDATE onboarding_steps SET
      title=$1, description=$2, target_kind=$3, target_route=$4, position=$5, is_active=$6, updated_at=NOW()
     WHERE id=$7`,
    [title, description, target_kind, target_route, position, is_active, id],
  );
  return getStep(id);
}

async function moveStep(id, direction) {
  const step = await getStep(id);
  if (!step) return null;
  const siblings = await listSteps(step.track_id);
  const idx = siblings.findIndex((s) => s.id === id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return step;
  const other = siblings[swapIdx];
  await query('UPDATE onboarding_steps SET position = $1, updated_at = NOW() WHERE id = $2', [other.position, step.id]);
  await query('UPDATE onboarding_steps SET position = $1, updated_at = NOW() WHERE id = $2', [step.position, other.id]);
  // Normalize sequential positions
  const refreshed = await listSteps(step.track_id);
  for (let i = 0; i < refreshed.length; i += 1) {
    if (refreshed[i].position !== i + 1) {
      await query('UPDATE onboarding_steps SET position = $1 WHERE id = $2', [i + 1, refreshed[i].id]);
    }
  }
  return getStep(id);
}

async function listOnboardingUsers({ status = '', department = '', q = '' } = {}) {
  const clauses = [];
  const params = [];
  if (status && ONBOARDING_STATUSES.includes(status)) {
    params.push(status);
    clauses.push(`u.onboarding_status = $${params.length}`);
  }
  if (department) {
    params.push(trimStr(department, 60));
    clauses.push(`COALESCE(u.department, '') = $${params.length}`);
  }
  if (q) {
    params.push(`%${trimStr(q, 80).toLowerCase()}%`);
    clauses.push(
      `(LOWER(COALESCE(u.display_name, '')) LIKE $${params.length}
       OR LOWER(u.username) LIKE $${params.length}
       OR LOWER(u.email) LIKE $${params.length})`,
    );
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT u.id, u.username, u.email, u.display_name, u.department, u.is_admin, u.active,
            u.onboarding_status, u.created_at
     FROM hub_users u
     ${where}
     ORDER BY u.display_name ASC, u.username ASC`,
    params,
  );

  const track = await getActiveTrack();
  let totalSteps = 0;
  let progressByUser = new Map();
  if (track) {
    const steps = await listSteps(track.id);
    totalSteps = steps.filter((s) => s.is_active).length;
    if (result.rows.length) {
      const ids = result.rows.map((r) => r.id);
      const prog = await query(
        `SELECT p.user_id, COUNT(*)::int AS done
         FROM onboarding_user_progress p
         JOIN onboarding_steps s ON s.id = p.step_id
         WHERE s.track_id = $1 AND p.user_id = ANY($2::uuid[]) AND s.is_active = true
         GROUP BY p.user_id`,
        [track.id, ids],
      );
      progressByUser = new Map(prog.rows.map((r) => [r.user_id, r.done]));
    }
  }

  return result.rows.map((row) => {
    const doneCount = progressByUser.get(row.id) || 0;
    const percent = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      displayName: row.display_name || row.username,
      department: row.department || null,
      isAdmin: Boolean(row.is_admin),
      active: row.active !== false,
      onboardingStatus: row.onboarding_status,
      createdAt: row.created_at,
      doneCount,
      totalSteps,
      percent,
    };
  });
}

async function getUserOnboardingDetail(userId) {
  const userRow = await query(
    `SELECT id, username, email, display_name, department, onboarding_status, created_at
     FROM hub_users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const user = userRow.rows[0];
  if (!user) return null;
  const data = await loadOnboardingForUser({
    id: user.id,
    onboardingStatus: user.onboarding_status,
  });
  const percent = data.total > 0 ? Math.round((data.doneCount / data.total) * 100) : 0;
  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name || user.username,
      department: user.department || null,
      onboardingStatus: user.onboarding_status,
      createdAt: user.created_at,
    },
    ...data,
    percent,
  };
}

async function adminSetOnboardingStatus(userId, status) {
  await setOnboardingStatus(userId, status);
  if (status === 'PENDING') {
    await query('DELETE FROM onboarding_user_progress WHERE user_id = $1', [userId]);
  }
  return true;
}

module.exports = {
  bodyFlag,
  loadHome,
  greetingForNow,
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
  getActiveTrack,
  listTracks,
  listSteps,
  getStep,
  loadOnboardingForUser,
  startOnboarding,
  completeStep,
  completeOnboarding,
  updateStep,
  moveStep,
  listOnboardingUsers,
  getUserOnboardingDetail,
  adminSetOnboardingStatus,
  LINK_CATEGORIES,
  CONTACT_DEPARTMENTS,
  ITEM_DEPARTMENTS,
  CONTENT_CATEGORIES,
  ITEM_KINDS,
  HOME_INTEGRATION_KINDS,
  TARGET_TYPES,
  EMPTY_STATES,
};

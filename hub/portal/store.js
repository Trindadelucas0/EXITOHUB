'use strict';

const { query, getPool } = require('../db');
const { setOnboardingStatus } = require('../auth');
const { mediaUrl } = require('./upload');
const {
  LINK_CATEGORIES,
  CONTACT_DEPARTMENTS,
  ITEM_DEPARTMENTS,
  CONTENT_CATEGORIES,
  ANNOUNCEMENT_KINDS,
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

async function countActiveItemsByKind() {
  const result = await query(
    `SELECT kind, COUNT(*)::int AS total
     FROM portal_items
     WHERE is_active = true
     GROUP BY kind`,
  );
  const map = {};
  for (const row of result.rows) {
    map[row.kind] = row.total;
  }
  return map;
}

function pushSearch(clauses, params, columns, q) {
  const term = trimStr(q, 80);
  if (!term) return;
  params.push(`%${term.toLowerCase()}%`);
  const idx = params.length;
  const parts = columns.map((col) => `LOWER(COALESCE(${col}, '')) LIKE $${idx}`);
  clauses.push(`(${parts.join(' OR ')})`);
}

function pushActiveSit(clauses, column, sit) {
  if (sit === 'ativo') clauses.push(`${column} = true`);
  if (sit === 'inativo') clauses.push(`${column} = false`);
}

async function countTable(table, whereSql = '', params = []) {
  const allowed = new Set([
    'portal_links',
    'portal_contacts',
    'portal_contents',
    'portal_announcements',
    'portal_events',
  ]);
  if (!allowed.has(table)) {
    throw Object.assign(new Error('Contagem inválida.'), { status: 400 });
  }
  const result = await query(`SELECT COUNT(*)::int AS n FROM ${table} ${whereSql}`, params);
  return result.rows[0].n;
}

function parsePortalDateTime(raw, field) {
  const value = trimStr(raw, 40);
  if (!value) throw Object.assign(new Error(`${field} é obrigatória.`), { status: 400 });
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) throw Object.assign(new Error(`${field} inválida.`), { status: 400 });
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00-03:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`${field} inválida.`), { status: 400 });
  }
  return date.toISOString();
}

function formatDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type).value;
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`;
}

async function listAnnouncements({ activeOnly = true, limit = null, q = '', sit = '' } = {}) {
  const clauses = [];
  const params = [];
  if (activeOnly) clauses.push('is_active = true');
  pushActiveSit(clauses, 'is_active', sit);
  pushSearch(clauses, params, ['title', 'body'], q);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const lim = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : null;
  const result = await query(
    `SELECT id, title, body, kind, published_at, is_active, created_at, updated_at
     FROM portal_announcements
     ${where}
     ORDER BY published_at DESC, created_at DESC
     ${lim ? `LIMIT ${lim}` : ''}`,
    params,
  );
  return result.rows;
}

async function getAnnouncement(id) {
  const result = await query(
    `SELECT id, title, body, kind, published_at, is_active, created_at, updated_at
     FROM portal_announcements WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

function parseAnnouncementBody(body) {
  const title = trimStr(body.title, 200);
  if (!title) throw Object.assign(new Error('Título é obrigatório.'), { status: 400 });
  const kind = trimStr(body.kind, 20) || 'operacional';
  if (!ANNOUNCEMENT_KINDS.some((k) => k.id === kind)) {
    throw Object.assign(new Error('Tipo inválido.'), { status: 400 });
  }
  return {
    title,
    body: trimStr(body.body, 5000) || null,
    kind,
    published_at: parsePortalDateTime(body.published_at, 'Data'),
    is_active: bodyFlag(body.is_active),
  };
}

async function createAnnouncement(body) {
  const data = parseAnnouncementBody(body);
  const result = await query(
    `INSERT INTO portal_announcements (title, body, kind, published_at, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [data.title, data.body, data.kind, data.published_at, data.is_active],
  );
  return getAnnouncement(result.rows[0].id);
}

async function updateAnnouncement(id, body) {
  const existing = await getAnnouncement(id);
  if (!existing) return null;
  const data = parseAnnouncementBody({
    title: body.title ?? existing.title,
    body: body.body ?? existing.body,
    kind: body.kind ?? existing.kind,
    published_at: body.published_at || formatDatetimeLocal(existing.published_at),
    is_active: body.is_active,
  });
  await query(
    `UPDATE portal_announcements
     SET title = $1, body = $2, kind = $3, published_at = $4, is_active = $5, updated_at = NOW()
     WHERE id = $6`,
    [data.title, data.body, data.kind, data.published_at, data.is_active, id],
  );
  return getAnnouncement(id);
}

async function setAnnouncementActive(id, active) {
  await query(
    'UPDATE portal_announcements SET is_active = $1, updated_at = NOW() WHERE id = $2',
    [Boolean(active), id],
  );
  return getAnnouncement(id);
}

async function deleteAnnouncement(id) {
  const existing = await getAnnouncement(id);
  if (!existing) return null;
  await query('DELETE FROM portal_announcements WHERE id = $1', [id]);
  return existing;
}

const EVENT_ATTENDEE_COUNT_SQL = `(SELECT COUNT(*)::int FROM portal_event_attendees a
  JOIN hub_users u ON u.id = a.user_id AND u.active = true
  WHERE a.event_id = portal_events.id) AS attendee_count`;

async function listEvents({ activeOnly = true, upcomingOnly = false, limit = null, q = '', sit = '' } = {}) {
  const clauses = [];
  const params = [];
  if (activeOnly) clauses.push('is_active = true');
  if (upcomingOnly) clauses.push('starts_at >= NOW()');
  pushActiveSit(clauses, 'is_active', sit);
  pushSearch(clauses, params, ['title', 'place'], q);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const lim = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : null;
  const result = await query(
    `SELECT id, title, place, starts_at, ends_at, is_active, created_at, updated_at,
            ${EVENT_ATTENDEE_COUNT_SQL}
     FROM portal_events
     ${where}
     ORDER BY starts_at ASC, created_at ASC
     ${lim ? `LIMIT ${lim}` : ''}`,
    params,
  );
  return result.rows;
}

async function getEvent(id) {
  const result = await query(
    `SELECT id, title, place, starts_at, ends_at, is_active, created_at, updated_at,
            ${EVENT_ATTENDEE_COUNT_SQL},
            (SELECT COALESCE(array_agg(a.user_id::text), '{}')
             FROM portal_event_attendees a WHERE a.event_id = portal_events.id) AS attendee_ids
     FROM portal_events WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUserIds(raw) {
  const list = Array.isArray(raw) ? raw : [raw];
  const ids = list.map((v) => trimStr(v, 40).toLowerCase()).filter((v) => UUID_RE.test(v));
  return [...new Set(ids)];
}

async function resolveActiveUserIds(raw) {
  const ids = parseUserIds(raw);
  if (!ids.length) return [];
  const result = await query(
    'SELECT id FROM hub_users WHERE id = ANY($1::uuid[]) AND active = true',
    [ids],
  );
  return result.rows.map((row) => row.id);
}

function parseEventBody(body) {
  const title = trimStr(body.title, 200);
  if (!title) throw Object.assign(new Error('Título é obrigatório.'), { status: 400 });
  const startsAt = parsePortalDateTime(body.starts_at, 'Data');
  const endsAt = trimStr(body.ends_at, 40) ? parsePortalDateTime(body.ends_at, 'Término') : null;
  if (endsAt && new Date(endsAt) < new Date(startsAt)) {
    throw Object.assign(new Error('O término é anterior ao início.'), { status: 400 });
  }
  return {
    title,
    place: trimStr(body.place, 200) || null,
    starts_at: startsAt,
    ends_at: endsAt,
    is_active: bodyFlag(body.is_active),
  };
}

async function requireAttendees(rawUserIds) {
  const userIds = await resolveActiveUserIds(rawUserIds);
  if (!userIds.length) {
    throw Object.assign(new Error('Marque ao menos um usuário.'), { status: 400 });
  }
  return userIds;
}

async function saveEventWithAttendees(id, data, userIds) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    let eventId = id;
    if (eventId) {
      await client.query(
        `UPDATE portal_events
         SET title = $1, place = $2, starts_at = $3, ends_at = $4, is_active = $5, updated_at = NOW()
         WHERE id = $6`,
        [data.title, data.place, data.starts_at, data.ends_at, data.is_active, eventId],
      );
      await client.query('DELETE FROM portal_event_attendees WHERE event_id = $1', [eventId]);
    } else {
      const inserted = await client.query(
        `INSERT INTO portal_events (title, place, starts_at, ends_at, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [data.title, data.place, data.starts_at, data.ends_at, data.is_active],
      );
      eventId = inserted.rows[0].id;
    }
    await client.query(
      `INSERT INTO portal_event_attendees (event_id, user_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT DO NOTHING`,
      [eventId, userIds],
    );
    await client.query('COMMIT');
    return eventId;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function createEvent(body) {
  const data = parseEventBody(body);
  const userIds = await requireAttendees(body.user_ids);
  const eventId = await saveEventWithAttendees(null, data, userIds);
  return getEvent(eventId);
}

async function updateEvent(id, body) {
  const existing = await getEvent(id);
  if (!existing) return null;
  const data = parseEventBody({
    title: body.title ?? existing.title,
    place: body.place ?? existing.place,
    starts_at: body.starts_at || formatDatetimeLocal(existing.starts_at),
    ends_at: body.ends_at ?? formatDatetimeLocal(existing.ends_at),
    is_active: body.is_active,
  });
  const userIds = await requireAttendees(body.user_ids);
  await saveEventWithAttendees(id, data, userIds);
  return getEvent(id);
}

/* ───────────── Agenda por pessoa ───────────── */

const AGENDA_TZ_OFFSET = '-03:00';
const DAY_MS = 24 * 60 * 60 * 1000;
const AGENDA_MAX_RANGE_DAYS = 62;

function spDayStart(dateStr) {
  return new Date(`${dateStr}T00:00:00${AGENDA_TZ_OFFSET}`);
}

function todayInSaoPaulo() {
  return formatDatetimeLocal(new Date()).slice(0, 10);
}

function parseAgendaRange(startRaw, endRaw) {
  const pick = (raw) => {
    const match = trimStr(raw, 40).match(/^(\d{4}-\d{2}-\d{2})/);
    if (!match) return null;
    const date = spDayStart(match[1]);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const start = pick(startRaw);
  const end = pick(endRaw);
  if (!start || !end || end <= start) {
    throw Object.assign(new Error('Período inválido.'), { status: 400 });
  }
  if (end - start > AGENDA_MAX_RANGE_DAYS * DAY_MS) {
    throw Object.assign(new Error('Período maior que 62 dias.'), { status: 400 });
  }
  return { start, end };
}

async function listEventsForUser(userId, { start, end }) {
  if (!userId) return [];
  const result = await query(
    `SELECT e.id, e.title, e.place, e.starts_at, e.ends_at,
            COALESCE(
              json_agg(
                json_build_object('id', u.id, 'name', COALESCE(NULLIF(u.display_name, ''), u.username))
                ORDER BY COALESCE(NULLIF(u.display_name, ''), u.username)
              ) FILTER (WHERE u.id IS NOT NULL),
              '[]'
            ) AS attendees
     FROM portal_events e
     JOIN portal_event_attendees me ON me.event_id = e.id AND me.user_id = $1
     LEFT JOIN portal_event_attendees a ON a.event_id = e.id
     LEFT JOIN hub_users u ON u.id = a.user_id AND u.active = true
     WHERE e.is_active = true
       AND e.starts_at < $3
       AND COALESCE(e.ends_at, e.starts_at) >= $2
     GROUP BY e.id
     ORDER BY e.starts_at ASC, e.created_at ASC`,
    [userId, start.toISOString(), end.toISOString()],
  );
  return result.rows;
}

function eventTouchesDay(event, dayStart) {
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  const starts = new Date(event.starts_at);
  const ends = event.ends_at ? new Date(event.ends_at) : starts;
  return starts < dayEnd && ends >= dayStart;
}

async function loadAgendaDays(userId) {
  const todayStart = spDayStart(todayInSaoPaulo());
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const events = await listEventsForUser(userId, {
    start: todayStart,
    end: new Date(todayStart.getTime() + 2 * DAY_MS),
  });
  return {
    agendaToday: events.filter((ev) => eventTouchesDay(ev, todayStart)),
    agendaTomorrow: events.filter((ev) => eventTouchesDay(ev, tomorrowStart)),
  };
}

function toCalendarEvent(event) {
  return {
    id: event.id,
    title: event.title,
    start: formatDatetimeLocal(event.starts_at),
    ...(event.ends_at ? { end: formatDatetimeLocal(event.ends_at) } : {}),
    place: event.place || null,
    attendees: event.attendees || [],
  };
}

async function setEventActive(id, active) {
  await query(
    'UPDATE portal_events SET is_active = $1, updated_at = NOW() WHERE id = $2',
    [Boolean(active), id],
  );
  return getEvent(id);
}

async function deleteEvent(id) {
  const existing = await getEvent(id);
  if (!existing) return null;
  await query('DELETE FROM portal_events WHERE id = $1', [id]);
  return existing;
}

async function loadPortalAdminSummary() {
  const [itemCounts, linksActive, contactsActive, contentsPublished, announcementsActive, eventsActive, featured] = await Promise.all([
    countActiveItemsByKind(),
    countTable('portal_links', 'WHERE is_active = true'),
    countTable('portal_contacts', 'WHERE is_active = true'),
    countTable('portal_contents', 'WHERE is_published = true'),
    countTable('portal_announcements', 'WHERE is_active = true'),
    countTable('portal_events', 'WHERE is_active = true'),
    query(`SELECT id, title FROM portal_items WHERE kind = 'video' AND is_featured = true LIMIT 1`),
  ]);
  return {
    itemCounts,
    linksActive,
    contactsActive,
    contentsPublished,
    announcementsActive,
    eventsActive,
    featuredVideo: featured.rows[0] || null,
  };
}

async function loadHome(userId = null) {
  const [links, contacts, contents, itemCounts, announcements, agenda] = await Promise.all([
    listLinks({ activeOnly: true }),
    listContacts({ activeOnly: true }),
    listContents({ publishedOnly: true }),
    countActiveItemsByKind(),
    listAnnouncements({ activeOnly: true, limit: 4 }),
    loadAgendaDays(userId),
  ]);
  const integrationCards = HOME_INTEGRATION_KINDS.map((kind) => ({
    kind,
    ...ITEM_KINDS[kind],
    itemCount: itemCounts[kind] || 0,
  }));
  const quickCards = Object.entries(ITEM_KINDS).map(([kind, meta]) => ({
    kind,
    ...meta,
    itemCount: itemCounts[kind] || 0,
  }));
  return {
    cards: integrationCards,
    quickCards,
    links,
    contacts,
    contents,
    itemCounts,
    announcements,
    agendaToday: agenda.agendaToday,
    agendaTomorrow: agenda.agendaTomorrow,
    announcementKinds: ANNOUNCEMENT_KINDS,
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

async function listLinks({ homeOnly = false, activeOnly = false, q = '', sit = '', category = '' } = {}) {
  const clauses = [];
  const params = [];
  if (activeOnly) clauses.push('is_active = true');
  if (homeOnly) clauses.push('show_on_home = true');
  pushActiveSit(clauses, 'is_active', sit);
  if (category && LINK_CATEGORIES.includes(category)) {
    params.push(category);
    clauses.push(`category = $${params.length}`);
  }
  pushSearch(clauses, params, ['name', 'url', 'description'], q);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT id, name, description, url, category, icon, is_active, show_on_home, sort_order, created_at, updated_at
     FROM portal_links ${where}
     ORDER BY sort_order ASC, name ASC`,
    params,
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
    show_on_home: true,
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

async function deleteLink(id) {
  const existing = await getLink(id);
  if (!existing) return null;
  await query('DELETE FROM portal_links WHERE id = $1', [id]);
  return existing;
}

/* ───────────── Contacts ───────────── */

async function listContacts({ homeOnly = false, activeOnly = false, department = '', q = '', sit = '' } = {}) {
  const clauses = [];
  const params = [];
  if (activeOnly) clauses.push('c.is_active = true');
  if (homeOnly) clauses.push('c.show_on_home = true');
  pushActiveSit(clauses, 'c.is_active', sit);
  if (department && CONTACT_DEPARTMENTS.includes(department)) {
    params.push(department);
    clauses.push(`c.department = $${params.length}`);
  }
  pushSearch(clauses, params, ['c.name', 'c.department', 'c.email', 'c.role'], q);
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
    show_on_home: true,
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

async function deleteContact(id) {
  const existing = await getContact(id);
  if (!existing) return null;
  await query('DELETE FROM portal_contacts WHERE id = $1', [id]);
  return existing;
}

/* ───────────── Contents (carousel) ───────────── */

async function listContents({ homeOnly = false, publishedOnly = false, q = '', sit = '' } = {}) {
  const clauses = [];
  const params = [];
  if (publishedOnly) clauses.push('is_published = true');
  if (homeOnly) clauses.push('show_on_home = true');
  pushActiveSit(clauses, 'is_published', sit);
  pushSearch(clauses, params, ['title', 'description', 'category'], q);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT id, title, description, image_file_id, category, target_type, target_url, target_route,
            is_published, show_on_home, sort_order, published_at, created_at, updated_at
     FROM portal_contents ${where}
     ORDER BY sort_order ASC, published_at DESC NULLS LAST, created_at DESC`,
    params,
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
    show_on_home: true,
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

async function deleteContent(id) {
  const existing = await getContent(id);
  if (!existing) return null;
  await query('DELETE FROM portal_contents WHERE id = $1', [id]);
  return existing;
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

  if (withThumb.external_url) {
    try {
      const yt = parseYoutubeEmbed(withThumb.external_url);
      youtube_id = yt.videoId;
      youtube_embed_url = yt.embedUrl;
      if (withThumb.kind === 'video') {
        href = yt.watchUrl;
      }
      if (!withThumb.thumbnail_url && withThumb.kind === 'video') {
        cover_url = `https://i.ytimg.com/vi/${yt.videoId}/hqdefault.jpg`;
      }
    } catch (_) {
      /* URL não é YouTube (ou inválida): mantém href/arquivo normal */
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

async function listItems(kind, { activeOnly = false, q = '', sit = '' } = {}) {
  if (!ITEM_KINDS[kind]) throw Object.assign(new Error('Tipo inválido.'), { status: 400 });
  const clauses = ['i.kind = $1'];
  const params = [kind];
  if (activeOnly) clauses.push('i.is_active = true');
  pushActiveSit(clauses, 'i.is_active', sit);
  pushSearch(clauses, params, ['i.title', 'i.category', 'i.department', 'i.version'], q);
  const result = await query(
    `SELECT i.id, i.kind, i.title, i.description, i.body, i.category, i.department, i.version,
            i.file_id, i.thumbnail_file_id, i.external_url, i.is_onboarding_required, i.is_active,
            i.is_featured, i.sort_order, i.created_at, i.updated_at,
            f.mime AS file_mime, tf.mime AS thumbnail_mime
     FROM portal_items i
     LEFT JOIN portal_files f ON f.id = i.file_id
     LEFT JOIN portal_files tf ON tf.id = i.thumbnail_file_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY i.sort_order ASC, i.title ASC`,
    params,
  );
  return result.rows.map(decorateItem);
}

async function getItem(id) {
  const result = await query(
    `SELECT i.id, i.kind, i.title, i.description, i.body, i.category, i.department, i.version,
            i.file_id, i.thumbnail_file_id, i.external_url, i.is_onboarding_required, i.is_active,
            i.is_featured, i.sort_order, i.created_at, i.updated_at,
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

async function countItemProgress(itemId) {
  const result = await query(
    'SELECT COUNT(*)::int AS n FROM portal_item_progress WHERE item_id = $1',
    [itemId],
  );
  return result.rows[0].n;
}

async function countItemProgressByKind(kind) {
  const result = await query(
    `SELECT p.item_id, COUNT(*)::int AS n
     FROM portal_item_progress p
     JOIN portal_items i ON i.id = p.item_id
     WHERE i.kind = $1
     GROUP BY p.item_id`,
    [kind],
  );
  const map = {};
  for (const row of result.rows) map[String(row.item_id)] = row.n;
  return map;
}

async function countItems(kind) {
  if (!ITEM_KINDS[kind]) throw Object.assign(new Error('Tipo inválido.'), { status: 400 });
  const result = await query(
    'SELECT COUNT(*)::int AS n FROM portal_items WHERE kind = $1',
    [kind],
  );
  return result.rows[0].n;
}

async function deleteItem(id) {
  const existing = await getItem(id);
  if (!existing) return null;
  const progressCount = await countItemProgress(id);
  await query('DELETE FROM portal_items WHERE id = $1', [id]);
  return { ...existing, progressCount };
}

async function setVideoFeatured(id, { confirm = false } = {}) {
  const item = await getItem(id);
  if (!item || item.kind !== 'video') {
    throw Object.assign(new Error('Vídeo não encontrado.'), { status: 404 });
  }
  if (item.is_featured) return item;
  const current = await query(
    `SELECT id, title FROM portal_items
     WHERE kind = 'video' AND is_featured = true
     LIMIT 1`,
  );
  const other = current.rows[0] || null;
  if (other && !confirm) {
    const err = Object.assign(new Error('Já existe um vídeo em destaque.'), { status: 409 });
    err.code = 'FEATURED_EXISTS';
    err.featuredId = other.id;
    err.featuredTitle = other.title;
    throw err;
  }
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE portal_items
       SET is_featured = false, updated_at = NOW()
       WHERE kind = 'video' AND is_featured = true`,
    );
    await client.query(
      `UPDATE portal_items
       SET is_featured = true, updated_at = NOW()
       WHERE id = $1 AND kind = 'video'`,
      [id],
    );
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
  return getItem(id);
}

/* ───────────── Item progress (sequential unlock) ───────────── */

const SEQUENTIAL_KINDS = new Set(['video', 'diagram', 'informative', 'catalog', 'document']);

async function listItemProgress(userId) {
  const result = await query(
    `SELECT item_id, completed_at FROM portal_item_progress WHERE user_id = $1`,
    [userId],
  );
  const map = new Map();
  for (const row of result.rows) {
    map.set(String(row.item_id), row.completed_at);
  }
  return map;
}

/**
 * Decora itens da área com unlocked / completed / progressStatus.
 * Ordem = lista já ordenada por sort_order (listItems).
 */
function decorateItemsForUser(items, progressMap, { selectedId = null } = {}) {
  const list = Array.isArray(items) ? items : [];
  let prevCompleted = true;
  return list.map((item, index) => {
    const id = String(item.id);
    const completed = progressMap.has(id);
    const unlocked = index === 0 || prevCompleted;
    prevCompleted = completed;

    let progressStatus = 'locked';
    if (completed) progressStatus = 'completed';
    else if (unlocked && selectedId && String(selectedId) === id) progressStatus = 'watching';
    else if (unlocked) progressStatus = 'available';

    return {
      ...item,
      unlocked,
      completed,
      progressStatus,
    };
  });
}

function firstUnlockedIncompleteId(decorated) {
  const open = decorated.find((it) => it.unlocked && !it.completed);
  if (open) return open.id;
  const lastUnlocked = [...decorated].reverse().find((it) => it.unlocked);
  return lastUnlocked ? lastUnlocked.id : null;
}

async function completeItem(userId, itemId) {
  const item = await getItem(itemId);
  if (!item || !item.is_active) {
    throw Object.assign(new Error('Item não encontrado.'), { status: 404 });
  }
  if (!SEQUENTIAL_KINDS.has(item.kind)) {
    throw Object.assign(new Error('Este tipo de item não usa progresso sequencial.'), { status: 400 });
  }

  const siblings = await listItems(item.kind, { activeOnly: true });
  const progress = await listItemProgress(userId);
  const decorated = decorateItemsForUser(siblings, progress);
  const current = decorated.find((it) => String(it.id) === String(itemId));
  if (!current) {
    throw Object.assign(new Error('Item não encontrado.'), { status: 404 });
  }
  if (!current.unlocked) {
    throw Object.assign(new Error('Conclua o item anterior antes de marcar este.'), { status: 403 });
  }

  await query(
    `INSERT INTO portal_item_progress (user_id, item_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, itemId],
  );

  const nextProgress = await listItemProgress(userId);
  const after = decorateItemsForUser(siblings, nextProgress);
  const idx = after.findIndex((it) => String(it.id) === String(itemId));
  const next = idx >= 0 && idx < after.length - 1 ? after[idx + 1] : null;
  return {
    item,
    nextId: next ? next.id : null,
    decorated: after,
  };
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
    `SELECT s.id, s.track_id, s.position, s.title, s.description,
            s.target_kind, s.target_id, s.target_route, s.is_active,
            s.youtube_url, s.video_download_url, s.pdf_file_id,
            s.created_at, s.updated_at,
            f.original_name AS pdf_original_name
     FROM onboarding_steps s
     LEFT JOIN portal_files f ON f.id = s.pdf_file_id
     WHERE s.track_id = $1
     ORDER BY s.position ASC`,
    [trackId],
  );
  return result.rows;
}

async function getStep(id) {
  const result = await query(
    `SELECT s.id, s.track_id, s.position, s.title, s.description,
            s.target_kind, s.target_id, s.target_route, s.is_active,
            s.youtube_url, s.video_download_url, s.pdf_file_id,
            s.created_at, s.updated_at,
            f.original_name AS pdf_original_name
     FROM onboarding_steps s
     LEFT JOIN portal_files f ON f.id = s.pdf_file_id
     WHERE s.id = $1 LIMIT 1`,
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
  if (!step || !step.id) return null;
  return `/portal/onboarding/etapas/${step.id}`;
}

function enrichStepMedia(step) {
  if (!step) return null;
  let youtube_embed_url = null;
  if (step.youtube_url) {
    try {
      youtube_embed_url = parseYoutubeEmbed(step.youtube_url).embedUrl;
    } catch (_) {
      youtube_embed_url = null;
    }
  }
  const pdf_url = step.pdf_file_id ? mediaUrl(step.pdf_file_id) : null;
  const hasYoutube = Boolean(youtube_embed_url);
  const hasVideoDownload = Boolean(step.video_download_url);
  const hasPdf = Boolean(pdf_url);
  return {
    ...step,
    youtube_embed_url,
    pdf_url,
    pdf_name: step.pdf_original_name || null,
    hasYoutube,
    hasVideoDownload,
    hasPdf,
    hasMedia: hasYoutube || hasVideoDownload || hasPdf,
    href: stepHref(step),
  };
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
    const media = enrichStepMedia(step);
    return {
      ...media,
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

async function updateStep(id, body, pdfFileId) {
  const existing = await getStep(id);
  if (!existing) return null;
  const title = trimStr(body.title, 200) || existing.title;
  const description = trimStr(body.description, 1000) || null;
  const target_kind = existing.target_kind;
  const target_route = existing.target_route;
  const position = parseSortOrder(body.position, existing.position);
  const is_active = Object.prototype.hasOwnProperty.call(body, 'is_active')
    ? bodyFlag(body.is_active)
    : existing.is_active;

  let youtube_url = existing.youtube_url || null;
  if (Object.prototype.hasOwnProperty.call(body, 'youtube_url')) {
    const raw = trimStr(body.youtube_url, 2000);
    youtube_url = raw ? parseYoutubeEmbed(raw).watchUrl : null;
  }

  let video_download_url = existing.video_download_url || null;
  if (Object.prototype.hasOwnProperty.call(body, 'video_download_url')) {
    video_download_url = assertOptionalHttpsUrl(body.video_download_url);
  }

  let pdf_file_id = existing.pdf_file_id || null;
  if (bodyFlag(body.remove_pdf)) {
    pdf_file_id = null;
  } else if (pdfFileId) {
    pdf_file_id = pdfFileId;
  }

  await query(
    `UPDATE onboarding_steps SET
      title=$1, description=$2, target_kind=$3, target_route=$4, position=$5, is_active=$6,
      youtube_url=$7, video_download_url=$8, pdf_file_id=$9, updated_at=NOW()
     WHERE id=$10`,
    [
      title, description, target_kind, target_route, position, is_active,
      youtube_url, video_download_url, pdf_file_id, id,
    ],
  );
  return getStep(id);
}

async function normalizeStepPositions(trackId) {
  const refreshed = await listSteps(trackId);
  for (let i = 0; i < refreshed.length; i += 1) {
    if (refreshed[i].position !== i + 1) {
      await query('UPDATE onboarding_steps SET position = $1 WHERE id = $2', [i + 1, refreshed[i].id]);
    }
  }
}

async function countStepProgress(stepId) {
  const result = await query(
    'SELECT COUNT(*)::int AS n FROM onboarding_user_progress WHERE step_id = $1',
    [stepId],
  );
  return result.rows[0].n;
}

async function countStepProgressByTrack(trackId) {
  const result = await query(
    `SELECT p.step_id, COUNT(*)::int AS n
     FROM onboarding_user_progress p
     JOIN onboarding_steps s ON s.id = p.step_id
     WHERE s.track_id = $1
     GROUP BY p.step_id`,
    [trackId],
  );
  const map = {};
  for (const row of result.rows) map[String(row.step_id)] = row.n;
  return map;
}

async function createStep(trackId, body, pdfFileId) {
  const track = await query(
    'SELECT id FROM onboarding_tracks WHERE id = $1 AND is_active = true LIMIT 1',
    [trackId],
  );
  if (!track.rows[0]) {
    throw Object.assign(new Error('Nenhuma trilha ativa.'), { status: 404 });
  }
  const title = trimStr(body.title, 200);
  if (!title) throw Object.assign(new Error('Título é obrigatório.'), { status: 400 });
  const siblings = await listSteps(trackId);
  const position = parseSortOrder(body.position, siblings.length + 1);
  const description = trimStr(body.description, 1000) || null;
  const rawYoutube = trimStr(body.youtube_url, 2000);
  const youtube_url = rawYoutube ? parseYoutubeEmbed(rawYoutube).watchUrl : null;
  const video_download_url = assertOptionalHttpsUrl(body.video_download_url);
  const is_active = bodyFlag(body.is_active);
  const result = await query(
    `INSERT INTO onboarding_steps
      (track_id, position, title, description, target_kind, target_route, is_active,
       youtube_url, video_download_url, pdf_file_id)
     VALUES ($1, $2, $3, $4, 'none', NULL, $5, $6, $7, $8)
     RETURNING id`,
    [
      trackId, position, title, description, is_active,
      youtube_url, video_download_url, pdfFileId || null,
    ],
  );
  await normalizeStepPositions(trackId);
  return getStep(result.rows[0].id);
}

async function deleteStep(id) {
  const existing = await getStep(id);
  if (!existing) return null;
  const progressCount = await countStepProgress(id);
  await query('DELETE FROM onboarding_steps WHERE id = $1', [id]);
  await normalizeStepPositions(existing.track_id);
  return { ...existing, progressCount };
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
    await query('DELETE FROM portal_item_progress WHERE user_id = $1', [userId]);
  }
  return true;
}

module.exports = {
  bodyFlag,
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
  countItemProgress,
  countItemProgressByKind,
  countItems,
  deleteItem,
  setVideoFeatured,
  listItemProgress,
  decorateItemsForUser,
  firstUnlockedIncompleteId,
  completeItem,
  SEQUENTIAL_KINDS,
  getActiveTrack,
  listTracks,
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
  countStepProgress,
  countStepProgressByTrack,
  moveStep,
  listOnboardingUsers,
  getUserOnboardingDetail,
  adminSetOnboardingStatus,
  LINK_CATEGORIES,
  CONTACT_DEPARTMENTS,
  ITEM_DEPARTMENTS,
  CONTENT_CATEGORIES,
  ANNOUNCEMENT_KINDS,
  ITEM_KINDS,
  HOME_INTEGRATION_KINDS,
  TARGET_TYPES,
  EMPTY_STATES,
};

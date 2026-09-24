'use strict';

const { query } = require('../db');

const META_KEY = 'portal_demo_seed_v1';
const EXITO_RESET_META = 'portal_exito_onboarding_reset_v2';

const PROGRESS_KINDS = ['video', 'diagram', 'informative', 'catalog', 'document'];

/** Faixas oficiais do álbum Máquina do Tempo (Matuê, 2020) — canal 30PRAUM. */
const ALBUM_TRACKS = [
  { title: 'Cogulândia', videoId: 'spIZM9Nnqa4', sort: 1 },
  { title: 'Antes', videoId: 'yHqOj8sLl_c', sort: 2 },
  { title: 'Gorila Roxo', videoId: 'BUL7zecHZjA', sort: 3 },
  { title: 'Vem Chapar', videoId: 'F-k8Q45hJmg', sort: 4 },
  { title: '777-666', videoId: 'd-GgZpCtBXw', sort: 5 },
  { title: 'É Sal', videoId: '5Z3-3qbxIN4', sort: 6 },
  { title: 'Máquina do Tempo', videoId: 'ZPcG9PCfagM', sort: 7 },
];

const DEMO_CONTACTS = [
  {
    name: 'Teste Fiscal',
    role: 'Analista fiscal',
    department: 'Fiscal',
    email: 'teste.fiscal@exito.local',
    whatsapp: '5511999900001',
    sort_order: 1,
  },
  {
    name: 'Teste RH',
    role: 'Analista de RH',
    department: 'RH',
    email: 'teste.rh@exito.local',
    whatsapp: '5511999900002',
    sort_order: 2,
  },
  {
    name: 'Teste TI',
    role: 'Suporte TI',
    department: 'TI',
    email: 'teste.ti@exito.local',
    whatsapp: '5511999900003',
    sort_order: 3,
  },
  {
    name: 'Teste Administrativo',
    role: 'Assistente administrativo',
    department: 'Administrativo',
    email: 'teste.admin@exito.local',
    whatsapp: '5511999900004',
    sort_order: 4,
  },
];

/** Itens TESTE por área (só se a kind estiver vazia de ativos). */
const AREA_DEMO_ITEMS = {
  diagram: [
    { title: 'TESTE · Visão geral da estrutura', description: 'Organograma simplificado da empresa.', sort_order: 1 },
    { title: 'TESTE · Setores e equipes', description: 'Como os departamentos se relacionam.', sort_order: 2 },
    { title: 'TESTE · Papéis do colaborador', description: 'Onde você se encaixa no diagrama.', sort_order: 3 },
  ],
  informative: [
    { title: 'TESTE · Bem-vindo ao portal', description: 'Informativo de demonstração para a trilha.', sort_order: 1 },
    { title: 'TESTE · Canais internos', description: 'Onde buscar ajuda no dia a dia.', sort_order: 2 },
    { title: 'TESTE · Cultura Êxito', description: 'Valores e práticas da equipe.', sort_order: 3 },
  ],
  catalog: [
    { title: 'TESTE · Catálogo de serviços', description: 'Materiais de referência (demo).', sort_order: 1 },
    { title: 'TESTE · Materiais da marca', description: 'Guia rápido de identidade (demo).', sort_order: 2 },
    { title: 'TESTE · Ferramentas do HUB', description: 'Lista de módulos disponíveis (demo).', sort_order: 3 },
  ],
  document: [
    { title: 'TESTE · Política interna', description: 'Documento corporativo de demonstração.', sort_order: 1 },
    { title: 'TESTE · Formulário de acesso', description: 'Modelo para solicitar acessos (demo).', sort_order: 2 },
    { title: 'TESTE · Checklist de integração', description: 'Passos essenciais do onboarding (demo).', sort_order: 3 },
  ],
};

function addDaysAtHour(baseDate, dayOffset, hour, minute) {
  const d = new Date(baseDate.getTime());
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

function buildDemoEvents() {
  const now = new Date();
  const spOffsetMs = 3 * 60 * 60 * 1000;
  const spNow = new Date(now.getTime() - spOffsetMs);
  const y = spNow.getUTCFullYear();
  const m = spNow.getUTCMonth();
  const day = spNow.getUTCDate();
  const noonSpAsUtc = new Date(Date.UTC(y, m, day, 12 + 3, 0, 0));

  return [
    {
      title: 'TESTE · Reunião geral',
      place: 'Sala 1',
      starts_at: addDaysAtHour(noonSpAsUtc, 1, 12, 0),
    },
    {
      title: 'TESTE · Treinamento interno',
      place: 'Auditório',
      starts_at: addDaysAtHour(noonSpAsUtc, 2, 14, 0),
    },
    {
      title: 'TESTE · Seminário corporativo',
      place: 'Online',
      starts_at: addDaysAtHour(noonSpAsUtc, 4, 13, 30),
    },
  ];
}

async function alreadySeeded() {
  const result = await query(`SELECT 1 FROM hub_meta WHERE key = $1 LIMIT 1`, [META_KEY]);
  return result.rowCount > 0;
}

async function markSeeded() {
  await query(
    `INSERT INTO hub_meta (key, value) VALUES ($1, '1')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [META_KEY],
  );
}

async function seedAnnouncements() {
  const rows = [
    {
      title: 'TESTE · Comunicado operacional',
      body: 'Lembrete de teste: atualize as leituras operacionais do portal até o fim da semana.',
      hoursAgo: 6,
    },
    {
      title: 'TESTE · Novidade no HUB',
      body: 'Conteúdo de demonstração para validar o painel de comunicados na Home.',
      hoursAgo: 30,
    },
    {
      title: 'TESTE · Aviso interno',
      body: 'Este é um comunicado de teste. Pode ser removido após a validação visual.',
      hoursAgo: 72,
    },
  ];
  for (const row of rows) {
    const publishedAt = new Date(Date.now() - row.hoursAgo * 60 * 60 * 1000);
    await query(
      `INSERT INTO portal_announcements (title, body, published_at, is_active)
       VALUES ($1, $2, $3, true)`,
      [row.title, row.body, publishedAt],
    );
  }
}

async function seedEvents() {
  for (const ev of buildDemoEvents()) {
    await query(
      `INSERT INTO portal_events (title, place, starts_at, is_active)
       VALUES ($1, $2, $3, true)`,
      [ev.title, ev.place, ev.starts_at],
    );
  }
}

async function seedContactsIfEmpty() {
  const existing = await query(`SELECT id FROM portal_contacts LIMIT 1`);
  if (existing.rowCount) return false;
  for (const c of DEMO_CONTACTS) {
    await query(
      `INSERT INTO portal_contacts
        (name, role, department, email, whatsapp, is_active, show_on_home, sort_order)
       VALUES ($1, $2, $3, $4, $5, true, true, $6)`,
      [c.name, c.role, c.department, c.email, c.whatsapp, c.sort_order],
    );
  }
  return true;
}

async function seedAlbumVideos() {
  await query(
    `UPDATE portal_items SET is_active = false, updated_at = NOW()
     WHERE kind = 'video' AND is_active = true`,
  );
  for (const track of ALBUM_TRACKS) {
    const watchUrl = `https://www.youtube.com/watch?v=${track.videoId}`;
    await query(
      `INSERT INTO portal_items
        (kind, title, description, body, category, department, version,
         external_url, is_onboarding_required, is_active, sort_order)
       VALUES
        ('video', $1, $2, NULL, 'TESTE', 'Geral', NULL,
         $3, false, true, $4)`,
      [
        track.title,
        `TESTE — Máquina do Tempo · faixa ${track.sort} de 7`,
        watchUrl,
        track.sort,
      ],
    );
  }
}

async function seedAreaItemsIfEmpty() {
  let insertedKinds = 0;
  for (const [kind, items] of Object.entries(AREA_DEMO_ITEMS)) {
    const existing = await query(
      `SELECT id FROM portal_items WHERE kind = $1 AND is_active = true LIMIT 1`,
      [kind],
    );
    if (existing.rowCount) continue;
    for (const item of items) {
      await query(
        `INSERT INTO portal_items
          (kind, title, description, body, category, department, version,
           external_url, is_onboarding_required, is_active, sort_order)
         VALUES
          ($1, $2, $3, NULL, 'TESTE', 'Geral', NULL,
           NULL, false, true, $4)`,
        [kind, item.title, item.description, item.sort_order],
      );
    }
    insertedKinds += 1;
  }
  return insertedKinds;
}

/**
 * Uma vez: coloca o(s) usuário(s) master EXITO em PENDING para preview de primeiro usuário.
 * Independente do seed demo v1 (pode já ter rodado).
 */
async function resetExitoOnboardingOnce() {
  const meta = await query(`SELECT 1 FROM hub_meta WHERE key = $1 LIMIT 1`, [EXITO_RESET_META]);
  if (meta.rowCount) return false;

  const username = String(process.env.HUB_SEED_ADMIN_USER || 'exito').trim().toLowerCase();
  const email = String(process.env.HUB_SEED_ADMIN_EMAIL || 'escritorio@local').trim().toLowerCase();

  const users = await query(
    `SELECT id, username FROM hub_users
     WHERE LOWER(username) = $1
        OR LOWER(email) = $2
        OR LOWER(username) = 'exito'
        OR LOWER(display_name) = 'exito'
     ORDER BY created_at ASC`,
    [username, email],
  );
  if (!users.rowCount) {
    await query(
      `INSERT INTO hub_meta (key, value) VALUES ($1, 'skipped-no-user')
       ON CONFLICT (key) DO NOTHING`,
      [EXITO_RESET_META],
    );
    return false;
  }

  for (const row of users.rows) {
    await query(
      `UPDATE hub_users SET onboarding_status = 'PENDING' WHERE id = $1`,
      [row.id],
    );
    await query(`DELETE FROM onboarding_user_progress WHERE user_id = $1`, [row.id]);
    await query(`DELETE FROM portal_item_progress WHERE user_id = $1`, [row.id]);
  }
  await query(
    `INSERT INTO hub_meta (key, value) VALUES ($1, '1')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [EXITO_RESET_META],
  );
  console.log(
    `[hub] EXITO em PENDING para preview de integração (${users.rows.map((r) => r.username).join(', ')})`,
  );
  return true;
}

async function seedDemoPortal() {
  if (!(await alreadySeeded())) {
    await seedAnnouncements();
    await seedEvents();
    await seedContactsIfEmpty();
    await seedAlbumVideos();
    await markSeeded();
    console.log(
      `[hub] seed demo portal: ${ALBUM_TRACKS.length} vídeos (Máquina do Tempo), comunicados, eventos e contatos de teste`,
    );
  }

  const areas = await seedAreaItemsIfEmpty();
  if (areas) {
    console.log(`[hub] seed demo: itens TESTE em ${areas} área(s) vazias`);
  }

  await resetExitoOnboardingOnce();
  return true;
}

module.exports = {
  seedDemoPortal,
  ALBUM_TRACKS,
  META_KEY,
  EXITO_RESET_META,
  PROGRESS_KINDS,
};

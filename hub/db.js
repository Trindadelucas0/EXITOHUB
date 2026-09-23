'use strict';

const { Client, Pool } = require('pg');
const bcrypt = require('bcryptjs');

const MODULES = ['folha', 'conci', 'ncm'];

let pool = null;

function resolveHost(host) {
  const value = String(host || '127.0.0.1').trim() || '127.0.0.1';
  if (value === 'localhost' || value === '::1') return '127.0.0.1';
  return value;
}

function getConfig(database) {
  const host = resolveHost(process.env.HUB_DB_HOST);
  const config = {
    host,
    port: Number(process.env.HUB_DB_PORT || 5432),
    user: process.env.HUB_DB_USER || 'postgres',
    password: process.env.HUB_DB_PASSWORD || '',
    database: database || process.env.HUB_DB_NAME || 'exito_hub',
  };
  if (host === '127.0.0.1') config.family = 4;
  return config;
}

function getPool() {
  if (!pool) pool = new Pool(getConfig());
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function ensureDatabase() {
  const targetDb = process.env.HUB_DB_NAME || 'exito_hub';
  const admin = new Client(getConfig('postgres'));
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);
    if (!exists.rowCount) {
      if (!/^[a-zA-Z0-9_]+$/.test(targetDb)) {
        throw new Error(`HUB_DB_NAME invalido: ${targetDb}`);
      }
      await admin.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`[hub] banco ${targetDb} criado`);
    }
  } finally {
    await admin.end();
  }
}

async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS hub_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS hub_user_modules (
      user_id UUID NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
      module TEXT NOT NULL CHECK (module IN ('folha', 'conci', 'ncm')),
      PRIMARY KEY (user_id, module)
    );

    CREATE TABLE IF NOT EXISTS hub_sessions (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_hub_sessions_user ON hub_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_hub_sessions_expires ON hub_sessions(expires_at);
  `);
  await query(`ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS landing_path TEXT`);
  await query(`
    ALTER TABLE hub_users
    ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'PENDING'
  `);
  await query(`
    DO $$ BEGIN
      ALTER TABLE hub_users
        ADD CONSTRAINT hub_users_onboarding_status_check
        CHECK (onboarding_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await query(`ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS department TEXT`);

  await query(`
    CREATE TABLE IF NOT EXISTS portal_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stored_path TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_by UUID REFERENCES hub_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`
    ALTER TABLE hub_users
    ADD COLUMN IF NOT EXISTS photo_file_id UUID REFERENCES portal_files(id) ON DELETE SET NULL
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS portal_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      url TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Outros',
      icon TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      show_on_home BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      role TEXT,
      department TEXT NOT NULL DEFAULT 'Outros',
      email TEXT,
      phone TEXT,
      whatsapp TEXT,
      description TEXT,
      photo_file_id UUID REFERENCES portal_files(id) ON DELETE SET NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      show_on_home BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_contents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      image_file_id UUID REFERENCES portal_files(id) ON DELETE SET NULL,
      category TEXT NOT NULL DEFAULT 'Empresa',
      target_type TEXT NOT NULL DEFAULT 'none'
        CHECK (target_type IN ('none', 'internal', 'external')),
      target_url TEXT,
      target_route TEXT,
      is_published BOOLEAN NOT NULL DEFAULT false,
      show_on_home BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS portal_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      kind TEXT NOT NULL
        CHECK (kind IN ('video', 'pop', 'informative', 'catalog', 'logo', 'diagram', 'document')),
      title TEXT NOT NULL,
      description TEXT,
      body TEXT,
      category TEXT,
      department TEXT,
      version TEXT,
      file_id UUID REFERENCES portal_files(id) ON DELETE SET NULL,
      thumbnail_file_id UUID REFERENCES portal_files(id) ON DELETE SET NULL,
      external_url TEXT,
      is_onboarding_required BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS onboarding_tracks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      department TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS onboarding_steps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      track_id UUID NOT NULL REFERENCES onboarding_tracks(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      target_kind TEXT NOT NULL DEFAULT 'none'
        CHECK (target_kind IN ('item', 'content', 'route', 'none')),
      target_id UUID,
      target_route TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS onboarding_user_progress (
      user_id UUID NOT NULL REFERENCES hub_users(id) ON DELETE CASCADE,
      step_id UUID NOT NULL REFERENCES onboarding_steps(id) ON DELETE CASCADE,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, step_id)
    );

    CREATE INDEX IF NOT EXISTS idx_portal_links_home
      ON portal_links (is_active, show_on_home, sort_order);
    CREATE INDEX IF NOT EXISTS idx_portal_contacts_home
      ON portal_contacts (is_active, show_on_home, sort_order);
    CREATE INDEX IF NOT EXISTS idx_portal_contents_home
      ON portal_contents (is_published, show_on_home, sort_order);
    CREATE INDEX IF NOT EXISTS idx_portal_items_kind
      ON portal_items (kind, is_active, sort_order);
    CREATE INDEX IF NOT EXISTS idx_onboarding_steps_track
      ON onboarding_steps (track_id, position);
  `);

  // Portal 1.4.2: documentos + metadados ricos em portal_items
  await query(`ALTER TABLE portal_items ADD COLUMN IF NOT EXISTS category TEXT`);
  await query(`ALTER TABLE portal_items ADD COLUMN IF NOT EXISTS department TEXT`);
  await query(`ALTER TABLE portal_items ADD COLUMN IF NOT EXISTS version TEXT`);
  await query(`ALTER TABLE portal_items ADD COLUMN IF NOT EXISTS thumbnail_file_id UUID`);
  await query(`ALTER TABLE portal_items ADD COLUMN IF NOT EXISTS is_onboarding_required BOOLEAN NOT NULL DEFAULT false`);
  await query(`
    DO $$ BEGIN
      ALTER TABLE portal_items
        ADD CONSTRAINT portal_items_thumbnail_file_id_fkey
        FOREIGN KEY (thumbnail_file_id) REFERENCES portal_files(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await query(`
    DO $$ BEGIN
      ALTER TABLE portal_items DROP CONSTRAINT IF EXISTS portal_items_kind_check;
      ALTER TABLE portal_items
        ADD CONSTRAINT portal_items_kind_check
        CHECK (kind IN ('video', 'pop', 'informative', 'catalog', 'logo', 'diagram', 'document'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await query(`ALTER TABLE onboarding_tracks ADD COLUMN IF NOT EXISTS department TEXT`);
  await query(`ALTER TABLE onboarding_steps ADD COLUMN IF NOT EXISTS youtube_url TEXT`);
  await query(`ALTER TABLE onboarding_steps ADD COLUMN IF NOT EXISTS video_download_url TEXT`);
  await query(`ALTER TABLE onboarding_steps ADD COLUMN IF NOT EXISTS pdf_file_id UUID`);
  await query(`
    DO $$ BEGIN
      ALTER TABLE onboarding_steps
        ADD CONSTRAINT onboarding_steps_pdf_file_id_fkey
        FOREIGN KEY (pdf_file_id) REFERENCES portal_files(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_portal_items_kind_active
      ON portal_items (kind, is_active, sort_order);
    CREATE INDEX IF NOT EXISTS idx_portal_contents_published_home
      ON portal_contents (is_published, show_on_home, sort_order);
    CREATE INDEX IF NOT EXISTS idx_hub_users_department
      ON hub_users (department);
  `);

  // Uma vez: quem já existia antes do portal não deve cair na trilha.
  // Usuários novos continuam PENDING via createUser.
  await query(`
    CREATE TABLE IF NOT EXISTS hub_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const backfill = await query(
    `SELECT 1 FROM hub_meta WHERE key = 'portal_onboarding_backfill_v1' LIMIT 1`,
  );
  if (!backfill.rowCount) {
    await query(
      `UPDATE hub_users SET onboarding_status = 'COMPLETED' WHERE onboarding_status = 'PENDING'`,
    );
    await query(
      `INSERT INTO hub_meta (key, value) VALUES ('portal_onboarding_backfill_v1', '1')
       ON CONFLICT (key) DO NOTHING`,
    );
    console.log('[hub] backfill onboarding: usuários existentes → COMPLETED');
  }
}

async function seedAdmin() {
  const username = String(process.env.HUB_SEED_ADMIN_USER || 'exito').trim().toLowerCase();
  const email = String(process.env.HUB_SEED_ADMIN_EMAIL || 'escritorio@local').trim().toLowerCase();
  const password = String(process.env.HUB_SEED_ADMIN_PASSWORD || '');
  if (!username || !email || !email.includes('@')) {
    console.warn('[hub] HUB_SEED_ADMIN_USER/EMAIL inválido — seed do admin ignorado');
    return;
  }
  if (!password) {
    console.warn('[hub] HUB_SEED_ADMIN_PASSWORD vazio — seed do admin ignorado');
    return;
  }

  const existing = await query(
    `SELECT id FROM hub_users
     WHERE LOWER(username) = $1 OR LOWER(email) = $2
     LIMIT 1`,
    [username, email],
  );
  if (existing.rowCount) return;

  const hash = await bcrypt.hash(password, 12);
  const inserted = await query(
    `INSERT INTO hub_users (username, email, password_hash, display_name, is_admin, active, onboarding_status)
     VALUES ($1, $2, $3, $4, true, true, 'COMPLETED')
     RETURNING id`,
    [username, email, hash, 'EXITO'],
  );
  const userId = inserted.rows[0].id;
  for (const mod of MODULES) {
    await query(
      `INSERT INTO hub_user_modules (user_id, module) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, mod],
    );
  }
  console.log(`[hub] admin seed criado: ${username}`);
}

async function ensureMasterUser() {
  const username = String(process.env.HUB_SEED_ADMIN_USER || 'exito').trim().toLowerCase();
  const email = String(process.env.HUB_SEED_ADMIN_EMAIL || 'escritorio@local').trim().toLowerCase();
  const canonicalUser = username === 'admin' ? 'exito' : username;
  const foundByEmail = await query(
    `SELECT id, username, email, password_hash, display_name
     FROM hub_users
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [email],
  );
  const found = foundByEmail.rowCount
    ? foundByEmail
    : await query(
      `SELECT id, username, email, password_hash, display_name
       FROM hub_users
       WHERE LOWER(username) = $1
       LIMIT 1`,
      [canonicalUser],
    );
  if (!found.rowCount) return;
  const row = found.rows[0];
  const displayName = String(row.display_name || '').trim();
  const nextName = !displayName || displayName.toLowerCase() === 'administrador' || displayName.toLowerCase() === 'admin'
    ? 'EXITO'
    : displayName;

  if (row.username !== canonicalUser) {
    const taken = await query(
      `SELECT id FROM hub_users WHERE LOWER(username) = $1 AND id <> $2 LIMIT 1`,
      [canonicalUser, row.id],
    );
    if (!taken.rowCount) {
      await query('UPDATE hub_users SET username = $1 WHERE id = $2', [canonicalUser, row.id]);
      row.username = canonicalUser;
    }
  }

  await query(
    `UPDATE hub_users
     SET is_admin = true, active = true, display_name = $1, landing_path = NULL,
         onboarding_status = 'COMPLETED'
     WHERE id = $2`,
    [nextName, row.id],
  );
  await query('DELETE FROM hub_user_modules WHERE user_id = $1', [row.id]);
  for (const mod of MODULES) {
    await query(
      `INSERT INTO hub_user_modules (user_id, module) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [row.id, mod],
    );
  }

  const { provisionConciUser, provisionNcmUser } = require('./provision-modules');
  await provisionConciUser({
    username: row.username,
    passwordHash: row.password_hash,
    displayName: nextName,
    role: 'admin',
    updatePassword: false,
  });
  await provisionNcmUser({
    email: row.email,
    name: nextName,
    passwordHash: row.password_hash,
    role: 'superadmin',
    updatePassword: false,
  });
  console.log(`[hub] master EXITO garantido: ${row.username} / ${row.email}`);
}

async function bootstrapHubDatabase() {
  await ensureDatabase();
  await ensureTables();
  await seedAdmin();
  try {
    await ensureMasterUser();
  } catch (err) {
    console.warn('[hub] master EXITO falhou:', err.message);
  }
  try {
    const { seedDefaultOnboardingTrack } = require('./portal/seed-onboarding');
    await seedDefaultOnboardingTrack();
  } catch (err) {
    console.warn('[hub] seed onboarding falhou:', err.message);
  }
  try {
    const { seedDefaultContents } = require('./portal/seed-contents');
    await seedDefaultContents();
  } catch (err) {
    console.warn('[hub] seed Conteúdos Êxito falhou:', err.message);
  }
  try {
    const { syncModuleUsers } = require('./sync-module-users');
    await syncModuleUsers();
  } catch (err) {
    console.warn('[hub] sync usuários dos módulos falhou:', err.message);
  }
  try {
    const { seedBaiferConsulta } = require('./seed-baifer-consulta');
    await seedBaiferConsulta();
  } catch (err) {
    console.warn('[hub] seed consulta BAIFER falhou:', err.message);
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  MODULES,
  getPool,
  query,
  bootstrapHubDatabase,
  ensureMasterUser,
  closePool,
};

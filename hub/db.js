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
}

async function seedAdmin() {
  const username = String(process.env.HUB_SEED_ADMIN_USER || '').trim().toLowerCase();
  const email = String(process.env.HUB_SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.HUB_SEED_ADMIN_PASSWORD || '');
  if (!username || !email || !password) {
    console.warn('[hub] HUB_SEED_ADMIN_* incompleto — seed do admin ignorado');
    return;
  }

  const existing = await query('SELECT id FROM hub_users WHERE LOWER(username) = $1 LIMIT 1', [username]);
  if (existing.rowCount) return;

  const hash = await bcrypt.hash(password, 12);
  const inserted = await query(
    `INSERT INTO hub_users (username, email, password_hash, display_name, is_admin, active)
     VALUES ($1, $2, $3, $4, true, true)
     RETURNING id`,
    [username, email, hash, 'Administrador'],
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

async function bootstrapHubDatabase() {
  await ensureDatabase();
  await ensureTables();
  await seedAdmin();
  try {
    const { syncModuleUsers } = require('./sync-module-users');
    await syncModuleUsers();
  } catch (err) {
    console.warn('[hub] sync usuários dos módulos falhou:', err.message);
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
  closePool,
};

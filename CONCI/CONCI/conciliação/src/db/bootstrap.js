'use strict';

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { getConfig, getPool, closePool } = require('./pool');

async function ensureDatabase() {
  const targetDb = process.env.HUB_MODE === '1'
    ? (process.env.CONCI_DB_NAME || process.env.DB_NAME || 'CONCI')
    : (process.env.DB_NAME || 'CONCI');
  const adminClient = new Client(getConfig('postgres'));
  await adminClient.connect();
  try {
    const exists = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDb],
    );
    if (!exists.rowCount) {
      // Identifiers cannot be parameterized; sanitize name
      if (!/^[a-zA-Z0-9_]+$/.test(targetDb)) {
        throw new Error(`DB_NAME invalido: ${targetDb}`);
      }
      await adminClient.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`[db] banco ${targetDb} criado`);
    } else {
      console.log(`[db] banco ${targetDb} ja existe`);
    }
  } finally {
    await adminClient.end();
  }
}

async function ensureTables() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS empresas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome TEXT NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'empresa')),
      empresa_id UUID NULL REFERENCES empresas(id) ON DELETE CASCADE,
      ativo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_empresa ON users(empresa_id);

    -- Admin pode “abrir” uma empresa e operar nela sem login separado.
    ALTER TABLE auth_sessions
      ADD COLUMN IF NOT EXISTS acting_empresa_id UUID NULL REFERENCES empresas(id) ON DELETE SET NULL;

    CREATE TABLE IF NOT EXISTS bancos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome TEXT NOT NULL UNIQUE,
      codigo_credito INT NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conciliacoes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      banco_id UUID NULL REFERENCES bancos(id) ON DELETE SET NULL,
      banco_nome TEXT,
      codigo_credito INT,
      competencia CHAR(7) NOT NULL,
      arquivos JSONB NOT NULL DEFAULT '{}'::jsonb,
      resumo JSONB NOT NULL DEFAULT '{}'::jsonb,
      itens JSONB NOT NULL DEFAULT '[]'::jsonb,
      used_gemini BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Marcação de "enviado": trava edição no histórico/revisão até desbloqueio com motivo.
    ALTER TABLE conciliacoes ADD COLUMN IF NOT EXISTS enviado BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE conciliacoes ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMPTZ NULL;
    ALTER TABLE conciliacoes ADD COLUMN IF NOT EXISTS motivos_edicao JSONB NOT NULL DEFAULT '[]'::jsonb;

    CREATE INDEX IF NOT EXISTS idx_conciliacoes_empresa_created
      ON conciliacoes (empresa_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conciliacoes_empresa_competencia
      ON conciliacoes (empresa_id, competencia);
  `);
}

async function ensureBancosSeed() {
  const pool = getPool();
  const seeds = [
    { nome: 'ITAU', codigoCredito: 9 },
    { nome: 'BANCO DO BRASIL', codigoCredito: 8 },
  ];
  for (const seed of seeds) {
    await pool.query(
      `INSERT INTO bancos (nome, codigo_credito, ativo)
       VALUES ($1, $2, true)
       ON CONFLICT (nome) DO NOTHING`,
      [seed.nome, seed.codigoCredito],
    );
  }
  console.log('[db] bancos seed ok');
}

async function ensureAdmin() {
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const pool = getPool();
  const existing = await pool.query(
    "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
  );
  if (existing.rowCount) {
    console.log('[db] admin ja existe');
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (username, password_hash, role, empresa_id, ativo)
     VALUES ($1, $2, 'admin', NULL, true)`,
    [username, hash],
  );
  console.log(`[db] admin criado: ${username}`);
}

async function ensureExtensions() {
  const pool = getPool();
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
}

/**
 * Garante banco, tabelas e admin seed. Idempotente.
 */
async function bootstrapDatabase() {
  await ensureDatabase();
  // Reset pool caso tenha sido criado antes apontando para DB inexistente
  await closePool();
  getPool();
  await ensureExtensions();
  await ensureTables();
  await ensureBancosSeed();
  await ensureAdmin();
}

module.exports = {
  bootstrapDatabase,
};

'use strict';

// Aplica os .sql de migrations/data em ordem, uma vez cada (tabela conci_data_migrations).
// Uso (raiz do EXITO HUB): npm run migrate-conci   |   --dry-run lista o que falta.

const fs = require('fs');
const path = require('path');

const conciRoot = path.resolve(__dirname, '..');
const hubRoot = path.resolve(conciRoot, '..', '..', '..');

require('dotenv').config({ path: path.join(hubRoot, '.env') });
require('dotenv').config({ path: path.join(conciRoot, '.env') });
if (process.env.CONCI_DB_NAME && !process.env.HUB_MODE) process.env.HUB_MODE = '1';

const { getPool, closePool, getConfig } = require('../src/db/pool');

const dataDir = path.join(conciRoot, 'migrations', 'data');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const cfg = getConfig();
  console.log(`[migrate-conci] banco ${cfg.database} em ${cfg.host}:${cfg.port}`);

  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conci_data_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = fs.existsSync(dataDir)
    ? fs.readdirSync(dataDir).filter((f) => f.endsWith('.sql')).sort()
    : [];
  const { rows } = await pool.query('SELECT name FROM conci_data_migrations');
  const done = new Set(rows.map((r) => r.name));
  const pending = files.filter((f) => !done.has(f));

  if (!pending.length) {
    console.log('[migrate-conci] nada pendente');
    return;
  }

  for (const file of pending) {
    if (dryRun) {
      console.log(`[migrate-conci] pendente: ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dataDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(sql);
      await client.query('INSERT INTO conci_data_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      const last = [].concat(result).filter((r) => r && r.rows && r.rows.length).pop();
      console.log(`[migrate-conci] aplicado: ${file}`);
      if (last) console.table(last.rows);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error(`${file}: ${err.message}`);
    } finally {
      client.release();
    }
  }
}

main()
  .catch((err) => {
    console.error('[migrate-conci] falhou, nada foi gravado deste arquivo:', err.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());

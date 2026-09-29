'use strict';

const fs = require('fs');
const { Client } = require('pg');

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

async function main() {
  const hub = loadEnv('/root/PROJETOS/exito/EXITOHUB/.env');
  const client = new Client({
    host: hub.CONCI_DB_HOST || '127.0.0.1',
    port: Number(hub.CONCI_DB_PORT || 5432),
    user: hub.CONCI_DB_USER || 'postgres',
    password: hub.CONCI_DB_PASSWORD || '',
    database: 'postgres',
  });
  await client.connect();
  const activity = await client.query(
    `SELECT datname, usename, state, wait_event_type, left(query, 160) AS query
     FROM pg_stat_activity
     WHERE datname IS NOT NULL
       AND query NOT ILIKE '%pg_stat_activity%'
     ORDER BY datname`,
  );
  for (const row of activity.rows) {
    console.log([row.datname, row.usename, row.state, row.query].join(' | '));
  }
  await client.end();
}

main().catch((err) => {
  console.error('ERR', err.message);
  process.exit(1);
});

'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv(file) {
  const out = {};
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

async function columns(label, cfg, database) {
  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database,
  });
  await client.connect();
  const result = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' ORDER BY 1",
  );
  console.log(label, database, result.rows.map((row) => row.column_name).join(',') || '(no users table)');
  await client.end();
}

async function main() {
  const hub = loadEnv('/root/PROJETOS/exito/EXITOHUB/.env');
  const base = {
    host: hub.CONCI_DB_HOST || '127.0.0.1',
    port: Number(hub.CONCI_DB_PORT || 5432),
    user: hub.CONCI_DB_USER || 'postgres',
    password: hub.CONCI_DB_PASSWORD || '',
  };
  for (const name of [hub.CONCI_DB_NAME || 'CONCI', hub.NCM_DB_NAME || 'fiscal-p', hub.HUB_DB_NAME || 'exito_hub', hub.FOLHA_DB_NAME || 'beatriz_impostos']) {
    try {
      await columns('hub-cred', base, name);
    } catch (err) {
      console.log('hub-cred', name, 'ERR', err.message);
    }
  }

  const standaloneEnv = '/root/PROJETOS/exito/CONCI/conciliação/.env';
  if (fs.existsSync(standaloneEnv)) {
    const stand = loadEnv(standaloneEnv);
    try {
      await columns('standalone', {
        host: stand.DB_HOST || '127.0.0.1',
        port: Number(stand.DB_PORT || 5432),
        user: stand.DB_USER || 'postgres',
        password: stand.DB_PASSWORD || '',
      }, stand.DB_NAME || 'CONCI');
    } catch (err) {
      console.log('standalone ERR', err.message);
    }
  }

  const poolPath = '/root/PROJETOS/exito/EXITOHUB/CONCI/CONCI/conciliação/src/db/pool.js';
  const pool = fs.readFileSync(poolPath, 'utf8');
  console.log('pool prefers CONCI_', pool.includes('CONCI_'));
}

main().catch((err) => {
  console.error('ERR', err.message);
  process.exit(1);
});

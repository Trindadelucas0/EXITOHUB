'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
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

function request(path, cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3010,
      path,
      method: 'GET',
      headers: cookie ? { Cookie: cookie } : {},
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          location: res.headers.location || '',
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const env = loadEnv('/root/PROJETOS/exito/EXITOHUB/.env');
  const client = new Client({
    host: env.HUB_DB_HOST || '127.0.0.1',
    port: Number(env.HUB_DB_PORT || 5432),
    user: env.HUB_DB_USER || 'postgres',
    password: env.HUB_DB_PASSWORD || '',
    database: env.HUB_DB_NAME || 'exito_hub',
  });
  await client.connect();
  const user = await client.query(
    `SELECT u.id, u.username
     FROM hub_users u
     JOIN hub_user_modules m ON m.user_id = u.id AND m.module = 'conci'
     WHERE u.active = true
     ORDER BY u.is_admin DESC, u.username
     LIMIT 1`,
  );
  if (!user.rowCount) {
    console.log('no conci user');
    await client.end();
    return;
  }
  const sessionId = crypto.randomUUID();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await client.query(
    'INSERT INTO hub_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [sessionId, user.rows[0].id, expires],
  );
  try {
    const cookie = `exito_hub_sid=${encodeURIComponent(sessionId)}`;
    console.log('user', user.rows[0].username);
    for (const path of ['/conci/', '/conci/admin/empresas', '/conci/historico']) {
      const page = await request(path, cookie);
      const flat = page.body.replace(/\s+/g, ' ');
      const snippet = flat.includes('last_empresa') || flat.startsWith('Erro:')
        ? flat.slice(0, 240)
        : `${page.status} ${page.location || flat.slice(0, 80)}`;
      console.log(path, snippet);
    }
  } finally {
    await client.query('DELETE FROM hub_sessions WHERE id = $1', [sessionId]);
    await client.end();
  }
}

main().catch((err) => {
  console.error('ERR', err.message);
  process.exit(1);
});

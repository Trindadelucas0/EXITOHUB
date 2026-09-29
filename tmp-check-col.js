'use strict';

require('dotenv').config();
const { Client } = require('pg');

const admin = new Client({
  host: process.env.CONCI_DB_HOST || '127.0.0.1',
  port: Number(process.env.CONCI_DB_PORT || 5432),
  user: process.env.CONCI_DB_USER || 'postgres',
  password: process.env.CONCI_DB_PASSWORD || process.env.HUB_DB_PASSWORD || '',
  database: 'postgres',
});

async function main() {
  await admin.connect();
  const dbs = await admin.query(
    `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`,
  );
  for (const row of dbs.rows) {
    const name = row.datname;
    const client = new Client({
      host: process.env.CONCI_DB_HOST || '127.0.0.1',
      port: Number(process.env.CONCI_DB_PORT || 5432),
      user: process.env.CONCI_DB_USER || 'postgres',
      password: process.env.CONCI_DB_PASSWORD || process.env.HUB_DB_PASSWORD || '',
      database: name,
    });
    try {
      await client.connect();
      const tables = await client.query(
        `SELECT n.nspname AS schema, c.relkind,
                EXISTS (
                  SELECT 1 FROM information_schema.columns col
                  WHERE col.table_schema = n.nspname
                    AND col.table_name = 'users'
                    AND col.column_name = 'last_empresa_id'
                ) AS has_col
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relname = 'users' AND c.relkind IN ('r', 'v', 'p')
           AND n.nspname NOT IN ('pg_catalog', 'information_schema')`,
      );
      if (tables.rows.length) {
        console.log(name, JSON.stringify(tables.rows));
      }
    } catch (err) {
      console.log(name, 'SKIP', err.message);
    } finally {
      await client.end().catch(() => {});
    }
  }
  await admin.end();
}

main().catch((err) => {
  console.error('ERR', err.message);
  process.exit(1);
});

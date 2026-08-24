'use strict';

const { Pool } = require('pg');

let pool = null;

function env(name, fallback = '') {
  if (process.env.HUB_MODE === '1') {
    const prefixed = process.env[`CONCI_${name}`];
    if (prefixed != null && prefixed !== '') return prefixed;
  }
  const value = process.env[name];
  if (value != null && value !== '') return value;
  return fallback;
}

function getConfig(database) {
  return {
    host: env('DB_HOST', 'localhost'),
    port: Number(env('DB_PORT', '5432')),
    database: database || env('DB_NAME', 'CONCI'),
    user: env('DB_USER', 'postgres'),
    password: env('DB_PASSWORD', ''),
  };
}

function getPool() {
  if (!pool) {
    pool = new Pool(getConfig());
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getConfig,
  getPool,
  query,
  closePool,
};

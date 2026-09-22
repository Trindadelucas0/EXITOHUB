'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { query, closePool } = require('./db');

async function main() {
  const pass = String(process.env.HUB_SEED_ADMIN_PASSWORD || '');
  if (!pass) {
    throw new Error('HUB_SEED_ADMIN_PASSWORD vazio no .env');
  }

  const found = await query(
    `SELECT id, username, email, active, is_admin
     FROM hub_users
     WHERE LOWER(username::text) IN ('exito', 'admin')
        OR LOWER(email::text) = 'escritorio@local'`,
  );
  console.log(JSON.stringify(found.rows, null, 2));
  if (!found.rowCount) {
    throw new Error('Usuário master não encontrado');
  }

  const hash = await bcrypt.hash(pass, 12);
  await query(
    'UPDATE hub_users SET password_hash = $1, active = true, is_admin = true WHERE id = $2',
    [hash, found.rows[0].id],
  );
  console.log(`PASSWORD_RESET_OK login=${found.rows[0].username} email=${found.rows[0].email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
process.env.HUB_MODE = '1';

const conciRoot = path.join(__dirname, 'CONCI', 'CONCI', 'conciliação');
const { query } = require(path.join(conciRoot, 'src', 'db', 'pool.js'));

query(
  `SELECT u.id, u.username, u.last_empresa_id
   FROM users u
   LIMIT 1`,
)
  .then((result) => {
    console.log('ok', result.rowCount, result.rows[0] ? result.rows[0].username : 'empty');
    process.exit(0);
  })
  .catch((err) => {
    console.error('ERR', err.message);
    process.exit(1);
  });

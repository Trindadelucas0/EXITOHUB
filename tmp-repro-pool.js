'use strict';

const path = require('path');
const dotenv = require('dotenv');

const rootDir = __dirname;
dotenv.config({ path: path.join(rootDir, '.env') });
process.env.HUB_MODE = '1';

function applyPrefixedEnv(prefix, map) {
  for (const [from, to] of Object.entries(map)) {
    const value = process.env[`${prefix}_${from}`];
    if (value != null && value !== '') {
      process.env[to] = value;
    }
  }
}

applyPrefixedEnv('FOLHA', {
  DB_HOST: 'DB_HOST',
  DB_PORT: 'DB_PORT',
  DB_USER: 'DB_USER',
  DB_PASSWORD: 'DB_PASSWORD',
  DB_NAME: 'DB_NAME',
});
applyPrefixedEnv('CONCI', {
  DB_HOST: 'DB_HOST',
  DB_PORT: 'DB_PORT',
  DB_USER: 'DB_USER',
  DB_PASSWORD: 'DB_PASSWORD',
  DB_NAME: 'DB_NAME',
});
applyPrefixedEnv('NCM', {
  DB_HOST: 'DB_HOST',
  DB_PORT: 'DB_PORT',
  DB_USER: 'DB_USER',
  DB_PASSWORD: 'DB_PASSWORD',
  DB_NAME: 'DB_NAME',
});

const conciRoot = path.join(rootDir, 'CONCI', 'CONCI', 'conciliação');
process.chdir(conciRoot);
dotenv.config();

const { getConfig } = require(path.join(conciRoot, 'src', 'db', 'pool.js'));
const cfg = getConfig();
console.log(JSON.stringify({
  hubMode: process.env.HUB_MODE,
  conciDbName: process.env.CONCI_DB_NAME || '',
  dbName: process.env.DB_NAME || '',
  ncmDbName: process.env.NCM_DB_NAME || '',
  poolDatabase: cfg.database,
  poolHost: cfg.host,
  poolUser: cfg.user,
}, null, 2));

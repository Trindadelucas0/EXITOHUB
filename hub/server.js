'use strict';

const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

const rootDir = path.join(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env') });

// Modo HUB: módulos não sobem listen próprio e usam SSO.
process.env.HUB_MODE = '1';
process.env.FOLHA_BASE_PATH = '/folha';
process.env.CONCI_BASE_PATH = '/conci';
process.env.NCM_BASE_PATH = '/ncm';
process.env.NEXT_PUBLIC_BASE_PATH = '/ncm';

// Propaga credenciais prefixadas para os apps filhos (eles ainda leem DB_*).
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
  STORAGE_BACKEND: 'STORAGE_BACKEND',
});
if (process.env.FOLHA_STORAGE_BACKEND) {
  process.env.STORAGE_BACKEND = process.env.FOLHA_STORAGE_BACKEND;
}

applyPrefixedEnv('CONCI', {
  DB_HOST: 'DB_HOST',
  DB_PORT: 'DB_PORT',
  DB_USER: 'DB_USER',
  DB_PASSWORD: 'DB_PASSWORD',
  DB_NAME: 'DB_NAME',
});

if (process.env.NCM_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.NCM_DATABASE_URL;
}
applyPrefixedEnv('NCM', {
  DB_HOST: 'DB_HOST',
  DB_PORT: 'DB_PORT',
  DB_USER: 'DB_USER',
  DB_PASSWORD: 'DB_PASSWORD',
  DB_NAME: 'DB_NAME',
});

const { bootstrapHubDatabase } = require('./db');
const hubRoutes = require('./routes');
const {
  hubSessionMiddleware,
  requireHubModule,
  mountBasePath,
} = require('./middleware');

const PORT = Number(process.env.PORT || 3000);

async function loadFolhaApp() {
  const folhaRoot = path.join(rootDir, 'BeatrizDt');
  const prevCwd = process.cwd();
  process.chdir(folhaRoot);
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const beatriz = require(path.join(folhaRoot, 'server.js'));
    return beatriz.getApp();
  } finally {
    process.chdir(prevCwd);
  }
}

async function loadConciApp() {
  const conciRoot = path.join(rootDir, 'CONCI', 'CONCI', 'conciliação');
  const prevCwd = process.cwd();
  process.chdir(conciRoot);
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const app = require(path.join(conciRoot, 'src', 'app.js'));
    const { bootstrapDatabase } = require(path.join(conciRoot, 'src', 'db', 'bootstrap.js'));
    await bootstrapDatabase();
    return app;
  } finally {
    process.chdir(prevCwd);
  }
}

async function prepareNcm() {
  const ncmDir = path.join(rootDir, 'NCM', 'fiscal');
  // Tailwind/PostCSS resolvem content relativo ao cwd — precisa ser NCM/fiscal.
  process.chdir(ncmDir);

  let next;
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    next = require(path.join(ncmDir, 'node_modules', 'next'));
  } catch {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    next = require('next');
  }
  const dev = process.env.NODE_ENV !== 'production';
  const nextApp = next({
    dev,
    dir: ncmDir,
  });
  await nextApp.prepare();
  return nextApp.getRequestHandler();
}

async function start() {
  await bootstrapHubDatabase();

  // Init Folha DB when not using JSON storage
  const folhaRoot = path.join(rootDir, 'BeatrizDt');
  const prevCwd = process.cwd();
  process.chdir(folhaRoot);
  try {
    process.env.STORAGE_BACKEND = process.env.FOLHA_STORAGE_BACKEND || process.env.STORAGE_BACKEND || 'postgres';
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const { useJsonStorage } = require(path.join(folhaRoot, 'services', 'storage'));
    if (!useJsonStorage()) {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const { initDatabase } = require(path.join(folhaRoot, 'services', 'db', 'database'));
      await initDatabase();
    }
  } finally {
    process.chdir(prevCwd);
  }

  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Next.js em /ncm precisa ler o body sozinho. Se o Express consumir o stream,
  // POST JSON/form do NCM trava (Cadastrando… / Abrindo… sem log de POST).
  const skipNcmBody = (parser) => (req, res, next) => {
    if (req.path.startsWith('/ncm')) return next();
    return parser(req, res, next);
  };
  app.use(skipNcmBody(express.urlencoded({ extended: true })));
  app.use(skipNcmBody(express.json({ limit: '2mb' })));
  app.use('/hub-assets', express.static(path.join(__dirname, 'public')));
  // Fallback do logo NCM quando o pedido chega sem /ncm (Image optimizer / bookmark).
  const ncmPublic = path.join(rootDir, 'NCM', 'fiscal', 'public');
  app.get(['/exito-logo.png', '/ncm/exito-logo.png'], (req, res, next) => {
    res.sendFile(path.join(ncmPublic, 'exito-logo.png'), (err) => {
      if (err) next();
    });
  });
  app.use(hubSessionMiddleware);
  app.use(hubRoutes);

  const folhaApp = await loadFolhaApp();
  app.use(
    '/folha',
    requireHubModule('folha'),
    mountBasePath('/folha'),
    (req, res, next) => {
      req.hubUserForModule = req.hubUser;
      next();
    },
    folhaApp,
  );

  const conciApp = await loadConciApp();
  app.use(
    '/conci',
    requireHubModule('conci'),
    mountBasePath('/conci'),
    (req, res, next) => {
      req.hubUserForModule = req.hubUser;
      next();
    },
    conciApp,
  );

  let ncmHandler = null;
  try {
    ncmHandler = await prepareNcm();
    console.log('[hub] NCM (Next.js) preparado em /ncm');
  } catch (err) {
    console.error('[hub] NCM não pôde ser preparado:', err.message);
    console.error('[hub] Rode npm install em NCM/fiscal e tente de novo.');
  }

  // Não usar app.use('/ncm', ...) — o Express remove o prefixo e quebra o basePath do Next.
  const guardNcm = requireHubModule('ncm');
  app.use((req, res, next) => {
    if (!req.path.startsWith('/ncm')) return next();
    return guardNcm(req, res, () => {
      if (!ncmHandler) {
        return res.status(503).send('Módulo NCM indisponível. Verifique a instalação do Next.js.');
      }
      return ncmHandler(req, res);
    });
  });

  app.use((err, req, res, next) => {
    console.error('[hub] error', err);
    if (res.headersSent) return next(err);
    res.status(500).send('Erro interno no EXITO HUB');
  });

  app.listen(PORT, () => {
    console.log(`EXITO HUB em http://localhost:${PORT}`);
    console.log('  /folha  → Folha & Fiscal (BeatrizDt)');
    console.log('  /conci  → Conciliação');
    console.log('  /ncm    → Auditor NCM');
  });
}

start().catch((err) => {
  console.error('Falha ao iniciar EXITO HUB:', err);
  process.exit(1);
});

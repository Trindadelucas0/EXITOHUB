'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const conciliacaoRoutes = require('./routes/conciliacao');
const preCadastroRoutes = require('./routes/preCadastro');
const { sessionMiddleware } = require('./middleware/session');
const { bootstrapDatabase } = require('./db/bootstrap');
const { clearAllSessions } = require('./services/sessionStore');

const app = express();
const PORT = process.env.PORT || 4444;
const hubMode = process.env.HUB_MODE === '1';
const basePath = process.env.CONCI_BASE_PATH || '';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

app.use((req, res, next) => {
  res.locals.basePath = basePath;
  res.locals.u = (p) => `${basePath}${String(p).startsWith('/') ? p : `/${p}`}`;
  res.locals.hubMode = hubMode;
  res.locals.hubUser = req.hubUserForModule || req.hubUser || null;
  res.locals.formatMoney = (v) => {
    if (v === null || v === undefined) return '';
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  res.locals.formatDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-');
    return `${d}/${m}/${y}`;
  };
  next();
});

if (hubMode) {
  app.use((req, res, next) => {
    if (req.hubSsoMissing) {
      return res.status(403).render('sso-missing', {
        title: 'Usuário não cadastrado na Conciliação',
        hubUser: res.locals.hubUser,
      });
    }
    next();
  });
}

app.use(authRoutes);
app.use(adminRoutes);
app.use(preCadastroRoutes);
app.use(conciliacaoRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(`Erro: ${err.message}`);
});

async function start() {
  await bootstrapDatabase();
  clearAllSessions();
  app.listen(PORT, () => {
    console.log(`Conciliacao rodando em http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Falha ao iniciar:', err.message);
    process.exit(1);
  });
}

module.exports = app;

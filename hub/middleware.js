'use strict';

const {
  COOKIE_NAME,
  parseCookies,
  getSessionUser,
  destroySession,
  clearSessionCookie,
} = require('./auth');

async function hubSessionMiddleware(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[COOKIE_NAME];
    req.hubSessionId = sessionId || null;
    req.hubUser = sessionId ? await getSessionUser(sessionId) : null;
    res.locals.hubUser = req.hubUser;
    res.locals.modules = {
      folha: Boolean(req.hubUser?.canFolha),
      conci: Boolean(req.hubUser?.canConci),
      ncm: Boolean(req.hubUser?.canNcm),
    };
    next();
  } catch (err) {
    next(err);
  }
}

function requireHubAuth(req, res, next) {
  if (!req.hubUser) {
    return res.redirect('/login');
  }
  return next();
}

function requireHubAdmin(req, res, next) {
  if (!req.hubUser) return res.redirect('/login');
  if (!req.hubUser.isAdmin) {
    return res.status(403).send('Acesso restrito ao administrador do HUB');
  }
  return next();
}

function requireHubModule(moduleName) {
  return (req, res, next) => {
    if (!req.hubUser) {
      return res.redirect('/login');
    }
    const allowed =
      (moduleName === 'folha' && req.hubUser.canFolha)
      || (moduleName === 'conci' && req.hubUser.canConci)
      || (moduleName === 'ncm' && req.hubUser.canNcm);
    if (!allowed) {
      return res.status(403).render('forbidden', {
        title: 'Sem permissão',
        moduleName,
        hubUser: req.hubUser,
      });
    }
    return next();
  };
}

async function logoutHub(req, res) {
  if (req.hubSessionId) {
    await destroySession(req.hubSessionId);
  }
  clearSessionCookie(res);
  req.hubUser = null;
  req.hubSessionId = null;
}

/**
 * Prefixa redirects absolutos do app montado com o basePath.
 * Links http(s) e relativo sem / ficam intactos.
 */
function mountBasePath(basePath) {
  return (req, res, next) => {
    const original = res.redirect.bind(res);
    res.redirect = (arg1, arg2) => {
      const hasStatus = typeof arg1 === 'number';
      const status = hasStatus ? arg1 : undefined;
      const url = hasStatus ? arg2 : arg1;
      const nextUrl = prefixPath(basePath, url);
      if (hasStatus) return original(status, nextUrl);
      return original(nextUrl);
    };
    res.locals.basePath = basePath;
    res.locals.hubBasePath = '';
    res.locals.u = (path) => prefixPath(basePath, path);
    next();
  };
}

function prefixPath(basePath, url) {
  if (url == null) return url;
  if (typeof url !== 'string') return url;
  if (!url.startsWith('/')) return url;
  if (url.startsWith('//')) return url;
  if (url === '/login' || url.startsWith('/login?')) return url;
  if (url === '/logout' || url.startsWith('/logout?')) return url;
  if (url === '/' && !basePath) return url;
  if (basePath && (url === basePath || url.startsWith(`${basePath}/`))) return url;
  // Login/logout do módulo → login do HUB
  if (url === '/login' || url.startsWith('/login?')) return '/login';
  return `${basePath}${url}`;
}

module.exports = {
  hubSessionMiddleware,
  requireHubAuth,
  requireHubAdmin,
  requireHubModule,
  logoutHub,
  mountBasePath,
  prefixPath,
};

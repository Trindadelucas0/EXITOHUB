function ensureAuthenticated(req, res, next) {
  if (process.env.HUB_MODE === '1') {
    const hub = req.hubUserForModule || req.hubUser;
    if (!hub) {
      return res.redirect('/login');
    }
    if (!req.session.user) {
      req.session.user = {
        username: hub.username,
        role: hub.isAdmin ? 'admin' : 'consulta',
        displayName: hub.displayName || hub.username,
      };
    }
    return next();
  }

  if (!req.session.user) {
    return res.redirect('/login');
  }

  return next();
}

function ensureAdmin(req, res, next) {
  ensureAuthenticated(req, res, () => {
    if (req.session.user.role !== 'admin') {
      return res.status(403).render('login', {
        title: 'Acesso restrito',
        error: 'Somente administradores podem alterar os dados.',
        lastUsername: req.session.user.username,
      });
    }
    return next();
  });
}

module.exports = {
  ensureAdmin,
  ensureAuthenticated,
};

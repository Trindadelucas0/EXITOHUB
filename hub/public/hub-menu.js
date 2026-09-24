(function () {
  const btn = document.getElementById('hub-menu-btn');
  const drawer = document.getElementById('hub-app-menu');
  const overlay = document.getElementById('hub-menu-overlay');

  if (drawer) {
    drawer.addEventListener('toggle', function (event) {
      const target = event.target;
      if (!(target instanceof HTMLDetailsElement)) return;
      if (!target.hasAttribute('data-hub-menu-level')) return;
      if (!target.open) return;
      const root = target.parentElement;
      if (!root) return;
      Array.prototype.forEach.call(root.children, function (el) {
        if (el === target) return;
        if (el.tagName === 'DETAILS' && el.hasAttribute('data-hub-menu-level')) {
          el.open = false;
        }
      });
    }, true);
  }

  if (!btn || !drawer) return;

  const mq = window.matchMedia('(min-width: 1024px)');

  function isDesktop() {
    return mq.matches;
  }

  function setOpen(open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('hub-sidebar-open', open);
    if (overlay) overlay.hidden = !open || isDesktop();
  }

  function syncDesktop() {
    if (isDesktop()) {
      setOpen(false);
      document.body.classList.remove('hub-sidebar-open');
      if (overlay) overlay.hidden = true;
    }
  }

  btn.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    if (isDesktop()) return;
    const open = btn.getAttribute('aria-expanded') !== 'true';
    setOpen(open);
  });

  if (overlay) {
    overlay.addEventListener('click', function () {
      setOpen(false);
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && document.body.classList.contains('hub-sidebar-open')) {
      setOpen(false);
    }
  });

  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', syncDesktop);
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(syncDesktop);
  }

  syncDesktop();
})();

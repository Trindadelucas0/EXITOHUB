(function () {
  const btn = document.getElementById('hub-menu-btn');
  const drawer = document.getElementById('hub-app-menu');
  const overlay = document.getElementById('hub-menu-overlay');
  const closeBtn = document.getElementById('hub-menu-close');

  if (!btn || !drawer || !overlay) return;

  // Evita stacking context do header/card prender o drawer/overlay.
  if (overlay.parentElement !== document.body) {
    document.body.appendChild(overlay);
  }
  if (drawer.parentElement !== document.body) {
    document.body.appendChild(drawer);
  }

  let lastFocus = null;

  function setOpen(open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Fechar menu de sistemas' : 'Abrir menu de sistemas');
    btn.setAttribute('data-open', open ? 'true' : 'false');

    if (open) {
      lastFocus = document.activeElement;
      drawer.hidden = false;
      overlay.hidden = false;
      document.body.classList.add('hub-menu-open');
      const focusTarget = closeBtn || drawer.querySelector('a, button');
      if (focusTarget) focusTarget.focus();
      return;
    }

    drawer.hidden = true;
    overlay.hidden = true;
    document.body.classList.remove('hub-menu-open');

    const restore = lastFocus && typeof lastFocus.focus === 'function' ? lastFocus : btn;
    // Adia o foco para não reabrir o menu com o mesmo clique/toque.
    window.setTimeout(() => {
      try {
        restore.focus();
      } catch (_) {
        btn.focus();
      }
    }, 0);
  }

  function toggle(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    setOpen(!isOpen);
  }

  function closeMenu(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setOpen(false);
  }

  btn.addEventListener('click', toggle);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
    }
  });
})();

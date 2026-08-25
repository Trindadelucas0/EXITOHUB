(function () {
  const btn = document.getElementById('hub-menu-btn');
  const drawer = document.getElementById('hub-app-menu');
  const overlay = document.getElementById('hub-menu-overlay');
  const closeBtn = document.getElementById('hub-menu-close');

  if (!btn || !drawer || !overlay) return;

  let lastFocus = null;

  function setOpen(open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Fechar menu de sistemas' : 'Abrir menu de sistemas');
    btn.setAttribute('data-open', open ? 'true' : 'false');

    if (open) {
      drawer.hidden = false;
      overlay.hidden = false;
      document.body.classList.add('hub-menu-open');
      lastFocus = document.activeElement;
      const focusTarget = closeBtn || drawer.querySelector('a, button');
      if (focusTarget) focusTarget.focus();
    } else {
      drawer.hidden = true;
      overlay.hidden = true;
      document.body.classList.remove('hub-menu-open');
      if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
      } else {
        btn.focus();
      }
    }
  }

  function toggle() {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    setOpen(!isOpen);
  }

  btn.addEventListener('click', toggle);
  if (closeBtn) closeBtn.addEventListener('click', () => setOpen(false));
  overlay.addEventListener('click', () => setOpen(false));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
    }
  });
})();

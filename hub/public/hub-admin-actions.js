(function () {
  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
      return;
    }
    dialog.setAttribute('open', '');
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
      return;
    }
    dialog.removeAttribute('open');
  }

  document.addEventListener('click', function (event) {
    const opener = event.target.closest('[data-open-dialog]');
    if (opener) {
      event.preventDefault();
      openDialog(document.getElementById(opener.getAttribute('data-open-dialog')));
      return;
    }
    const closer = event.target.closest('[data-close-dialog]');
    if (closer) {
      event.preventDefault();
      closeDialog(closer.closest('dialog'));
      return;
    }
    const dialog = event.target;
    if (!(dialog instanceof HTMLElement) || !dialog.matches('dialog.hub-dialog')) return;
    const box = dialog.getBoundingClientRect();
    const outside = event.clientX < box.left || event.clientX > box.right
      || event.clientY < box.top || event.clientY > box.bottom;
    if (outside) closeDialog(dialog);
  });

  document.addEventListener('submit', function (event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-once')) return;
    if (form.dataset.submitting === '1') {
      event.preventDefault();
      return;
    }
    form.dataset.submitting = '1';
    form.querySelectorAll('button[type="submit"]').forEach(function (btn) {
      btn.disabled = true;
      const busy = btn.getAttribute('data-busy');
      if (busy) btn.textContent = busy;
    });
  });

  window.addEventListener('pageshow', function () {
    document.querySelectorAll('form[data-once]').forEach(function (form) {
      delete form.dataset.submitting;
      form.querySelectorAll('button[type="submit"]').forEach(function (btn) {
        btn.disabled = false;
      });
    });
  });

  const autoDialog = document.querySelector('dialog[data-auto-open]');
  if (autoDialog) openDialog(autoDialog);

  const previewName = document.querySelector('[data-preview-name]');
  const previewUrl = document.querySelector('[data-preview-url]');
  function syncPreview(input) {
    const key = input.getAttribute('data-preview-source');
    const value = input.value.trim();
    if (key === 'name' && previewName) previewName.textContent = value || 'Nome do link';
    if (key === 'url' && previewUrl) previewUrl.textContent = value || 'https://';
  }
  document.querySelectorAll('[data-preview-source]').forEach(function (input) {
    input.addEventListener('input', function () { syncPreview(input); });
  });

  const filterForm = document.querySelector('[data-users-filter]');
  if (filterForm && filterForm.dataset.filterBound !== '1') {
    filterForm.dataset.filterBound = '1';
    let timer = null;
    function applyListFilter() {
      window.clearTimeout(timer);
      filterForm.submit();
    }
    filterForm.querySelectorAll('select').forEach(function (select) {
      select.addEventListener('change', applyListFilter);
    });
    const search = filterForm.querySelector('input[name="q"]');
    if (search) {
      search.addEventListener('input', function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(applyListFilter, 280);
      });
      search.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        applyListFilter();
      });
    }
    filterForm.querySelectorAll('button[type="submit"]').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        applyListFilter();
      });
    });
  }
})();

(function () {
  function setRowBusy(row, busy) {
    if (!row) return;
    row.querySelectorAll('textarea, input[type="file"], button').forEach(function (el) {
      el.disabled = busy;
    });
  }

  function setStatus(row, text, isError) {
    const status = row && row.querySelector('[data-apuracao-status]');
    if (!status) return;
    status.textContent = text || '';
    status.classList.toggle('is-error', Boolean(isError));
    if (text && !isError) {
      window.clearTimeout(status._hideTimer);
      status._hideTimer = window.setTimeout(function () {
        status.textContent = '';
      }, 2500);
    }
  }

  function mimeLabel(mime) {
    if (String(mime || '').indexOf('pdf') !== -1) return 'PDF';
    return 'DOC';
  }

  function appendFileChip(list, file) {
    if (!list || !file) return;
    const li = document.createElement('li');
    li.className = 'apuracao-file-chip';
    li.dataset.arquivoId = file.id;
    li.innerHTML = ''
      + '<span class="apuracao-file-chip__icon" aria-hidden="true">' + mimeLabel(file.mime) + '</span>'
      + '<span class="apuracao-file-chip__name" title="' + String(file.nome || '').replace(/"/g, '&quot;') + '">'
      + (file.nome || 'Arquivo') + '</span>'
      + '<a class="apuracao-file-chip__link" href="' + file.url + '" target="_blank" rel="noopener noreferrer">Baixar</a>'
      + '<button type="button" class="apuracao-file-chip__remove" data-remove-arquivo="' + file.id
      + '" aria-label="Remover">×</button>';
    list.appendChild(li);
  }

  function submitObservacao(form, row) {
    if (!form || !row || form.dataset.submitting === '1') return;
    form.dataset.submitting = '1';
    setRowBusy(row, true);
    setStatus(row, 'Salvando…', false);

    const obsEl = row.querySelector('textarea[name="observacao"]');
    const params = new URLSearchParams();
    if (obsEl) params.set('observacao', obsEl.value);

    fetch(form.action, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: params.toString(),
      credentials: 'same-origin',
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        }).catch(function () {
          return { ok: res.ok, data: {} };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          const msg = (result.data && result.data.error) || 'Não foi possível salvar.';
          setStatus(row, msg, true);
          return;
        }
        if (obsEl) obsEl.dataset.initialValue = obsEl.value;
        setStatus(row, 'Salvo', false);
      })
      .catch(function () {
        setStatus(row, 'Não foi possível salvar.', true);
      })
      .finally(function () {
        delete form.dataset.submitting;
        setRowBusy(row, false);
      });
  }

  function uploadArquivo(row, file) {
    const empresaId = row && row.getAttribute('data-empresa-id');
    if (!empresaId || !file) return;
    setRowBusy(row, true);
    setStatus(row, 'Enviando…', false);

    const body = new FormData();
    body.append('arquivo', file);

    fetch('/fiscal/apuracao-simples/' + empresaId + '/arquivo', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: body,
      credentials: 'same-origin',
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        }).catch(function () {
          return { ok: res.ok, data: {} };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          const msg = (result.data && result.data.error) || 'Não foi possível enviar.';
          setStatus(row, msg, true);
          return;
        }
        const list = row.querySelector('[data-apuracao-file-list]');
        if (result.data && result.data.file) {
          appendFileChip(list, result.data.file);
        }
        setStatus(row, 'Anexo enviado', false);
      })
      .catch(function () {
        setStatus(row, 'Não foi possível enviar.', true);
      })
      .finally(function () {
        setRowBusy(row, false);
        const input = row.querySelector('[data-apuracao-file-input]');
        if (input) input.value = '';
      });
  }

  function removeArquivo(row, arquivoId) {
    const empresaId = row && row.getAttribute('data-empresa-id');
    if (!empresaId || !arquivoId) return;
    setRowBusy(row, true);
    setStatus(row, 'Removendo…', false);

    fetch('/fiscal/apuracao-simples/' + empresaId + '/arquivo/' + arquivoId, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        }).catch(function () {
          return { ok: res.ok, data: {} };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          const msg = (result.data && result.data.error) || 'Não foi possível remover.';
          setStatus(row, msg, true);
          return;
        }
        const chip = row.querySelector('[data-arquivo-id="' + arquivoId + '"]');
        if (chip) chip.remove();
        setStatus(row, 'Removido', false);
      })
      .catch(function () {
        setStatus(row, 'Não foi possível remover.', true);
      })
      .finally(function () {
        setRowBusy(row, false);
      });
  }

  document.querySelectorAll('[data-apuracao-row]').forEach(function (row) {
    const formId = row.querySelector('textarea[form]') && row.querySelector('textarea[form]').getAttribute('form');
    const form = formId ? document.getElementById(formId) : null;

    const obs = row.querySelector('textarea[name="observacao"]');
    if (obs && form) {
      obs.dataset.initialValue = obs.value;
      obs.addEventListener('blur', function () {
        const initial = obs.dataset.initialValue != null ? obs.dataset.initialValue : '';
        if (obs.value === initial) return;
        submitObservacao(form, row);
      });
    }

    const fileInput = row.querySelector('[data-apuracao-file-input]');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        const file = fileInput.files && fileInput.files[0];
        if (file) uploadArquivo(row, file);
      });
    }

    row.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-remove-arquivo]');
      if (!btn) return;
      event.preventDefault();
      const arquivoId = btn.getAttribute('data-remove-arquivo');
      if (arquivoId) removeArquivo(row, arquivoId);
    });
  });
})();

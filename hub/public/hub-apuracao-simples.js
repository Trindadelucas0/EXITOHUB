(function () {
  var ANEXO_LEI = {
    I: {
      title: 'Anexo I',
      text: 'Receitas da revenda de mercadorias (comércio). LC 123/2006, art. 18, § 4º, I.',
    },
    II: {
      title: 'Anexo II',
      text: 'Receitas da venda de mercadorias industrializadas pelo contribuinte (indústria). LC 123/2006, art. 18, § 4º, II.',
    },
    III: {
      title: 'Anexo III',
      text: 'Receitas de prestação de serviços e de locação de bens móveis, exceto as dos Anexos IV e V. LC 123/2006, art. 18, § 4º, III.',
    },
    IV: {
      title: 'Anexo IV',
      text: 'Serviços com a contribuição previdenciária patronal (CPP) fora do DAS. LC 123/2006, art. 18, § 4º, IV.',
    },
    V: {
      title: 'Anexo V',
      text: 'Serviços sujeitos ao fator R. LC 123/2006, art. 18, § 4º, V.',
    },
  };

  var ANEXO_ATIVIDADE = {
    I: 'ANEXO I — Comércio',
    II: 'ANEXO II — Fábricas/indústrias',
    III:
      'ANEXO III — Serviços de instalação, de reparos e de manutenção, além de agências de viagens, treinamentos e algumas atividades que a Receita não considera que deva possuir responsabilidade técnica.',
    IV: 'ANEXO IV — Serviço de limpeza, vigilância, obras, construção de imóveis, serviços advocatícios.',
    V: 'ANEXO V — Serviços de auditoria, jornalismo, tecnologia, publicidade, engenharia, entre outros.',
  };

  var EMPTY_LEI = {
    title: 'Anexo',
    text: 'Selecione um anexo para ver a lei.',
  };

  function syncAnexoSelectTitle(select) {
    if (!select) return;
    select.title = ANEXO_ATIVIDADE[select.value] || '';
  }

  var leiDialog = document.getElementById('apuracao-anexo-lei');
  var leiTitle = leiDialog && leiDialog.querySelector('[data-apuracao-lei-title]');
  var leiText = leiDialog && leiDialog.querySelector('[data-apuracao-lei-text]');

  function setRowBusy(row, busy) {
    if (!row) return;
    row.querySelectorAll('textarea, select, button').forEach(function (el) {
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

  function rowAnexoValue(row) {
    var sel = row && row.querySelector('select[name="anexo"]');
    return sel ? sel.value : '';
  }

  function fillLeiDialog(anexoKey) {
    if (!leiDialog || !leiTitle || !leiText) return;
    var info = ANEXO_LEI[anexoKey] || EMPTY_LEI;
    leiTitle.textContent = info.title;
    leiText.textContent = info.text;
  }

  function toggleLeiDialog(anexoKey) {
    if (!leiDialog || typeof leiDialog.showModal !== 'function') return;
    if (leiDialog.open) {
      leiDialog.close();
      return;
    }
    fillLeiDialog(anexoKey);
    leiDialog.showModal();
  }

  function submitRow(form, row) {
    if (!form || !row || form.dataset.submitting === '1') return;
    form.dataset.submitting = '1';
    setRowBusy(row, true);
    setStatus(row, 'Salvando…', false);

    const obsEl = row.querySelector('textarea[name="observacao"]');
    const anexoEl = row.querySelector('select[name="anexo"]');
    const params = new URLSearchParams();
    if (obsEl) params.set('observacao', obsEl.value);
    params.set('anexo', anexoEl ? anexoEl.value : '');

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
        if (anexoEl) anexoEl.dataset.initialValue = anexoEl.value;
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

  document.querySelectorAll('[data-apuracao-row]').forEach(function (row) {
    const formId = row.querySelector('textarea[form]') && row.querySelector('textarea[form]').getAttribute('form');
    const form = formId ? document.getElementById(formId) : null;

    const obs = row.querySelector('textarea[name="observacao"]');
    if (obs && form) {
      obs.dataset.initialValue = obs.value;
      obs.addEventListener('blur', function () {
        const initial = obs.dataset.initialValue != null ? obs.dataset.initialValue : '';
        if (obs.value === initial) return;
        submitRow(form, row);
      });
    }

    const anexo = row.querySelector('select[name="anexo"]');
    if (anexo && form) {
      syncAnexoSelectTitle(anexo);
      anexo.dataset.initialValue = anexo.value;
      anexo.addEventListener('change', function () {
        syncAnexoSelectTitle(anexo);
        const initial = anexo.dataset.initialValue != null ? anexo.dataset.initialValue : '';
        if (anexo.value === initial) return;
        submitRow(form, row);
      });
    }

    const leiBtn = row.querySelector('[data-apuracao-lei-btn]');
    if (leiBtn) {
      leiBtn.addEventListener('click', function (event) {
        event.preventDefault();
        toggleLeiDialog(rowAnexoValue(row));
      });
    }
  });
})();

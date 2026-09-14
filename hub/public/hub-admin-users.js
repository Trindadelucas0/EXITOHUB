(function () {
  const dialog = document.getElementById("hub-user-sheet");
  const form = document.getElementById("hub-user-form");
  const filterForm = document.querySelector("[data-users-filter]");

  function syncConciEmpresaWrap(target) {
    target.querySelectorAll("[data-conci-role]").forEach(function (select) {
      const panel = select.closest("[data-mod-panel='conci'], .hub-sheet-body, form");
      const wrap = panel && panel.querySelector("[data-conci-empresa-wrap]");
      if (!wrap) return;
      wrap.hidden = select.value === "admin";
    });
  }

  function syncModPanels(target) {
    const toggles = target.querySelectorAll("[data-mod-toggle]");
    toggles.forEach(function (input) {
      const mod = input.getAttribute("data-mod-toggle");
      const panel = target.querySelector("[data-mod-panel='" + mod + "']");
      if (!panel) return;
      panel.hidden = !input.checked;
    });
    syncConciEmpresaWrap(target);
  }

  function closeHubMenu() {
    const closeBtn = document.getElementById("hub-menu-close");
    const drawer = document.getElementById("hub-app-menu");
    if (drawer && !drawer.hidden && closeBtn) closeBtn.click();
  }

  function listUrlFromHere() {
    const url = new URL(window.location.href);
    url.searchParams.delete("novo");
    url.searchParams.delete("editar");
    url.searchParams.delete("confirmar");
    url.searchParams.delete("erro");
    url.searchParams.delete("ok");
    return url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : "");
  }

  function replaceUrl(href) {
    window.history.replaceState({}, "", href);
  }

  function showConfirm(on) {
    const def = form && form.querySelector("[data-foot-default]");
    const conf = form && form.querySelector("[data-foot-confirm]");
    if (def) def.hidden = on;
    if (conf) conf.hidden = !on;
  }

  function upgradeToModal() {
    if (!dialog || typeof dialog.showModal !== "function") return;
    if (!dialog.hasAttribute("open")) return;
    closeHubMenu();
    try {
      dialog.removeAttribute("open");
      dialog.showModal();
    } catch (_) {
      dialog.setAttribute("open", "");
    }
  }

  function openSheet() {
    if (!dialog) return;
    closeHubMenu();
    showConfirm(false);
    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    const first = form && form.querySelector("input:not([readonly]):not([type='hidden']):not([type='checkbox'])");
    if (first) first.focus();
    if (form) syncModPanels(form);
  }

  function closeSheet() {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    showConfirm(false);
    replaceUrl(listUrlFromHere());
  }

  if (form) {
    form.addEventListener("change", function (event) {
      if (event.target.matches("[data-mod-toggle], [data-conci-role]")) {
        syncModPanels(form);
      }
    });
    syncModPanels(form);

    form.addEventListener("submit", function (event) {
      const submitter = event.submitter;
      window.setTimeout(function () {
        form.querySelectorAll("button[type='submit']").forEach(function (btn) {
          btn.disabled = true;
        });
        if (submitter && submitter.hasAttribute("data-save-submit")) {
          submitter.textContent = "Salvando…";
        }
      }, 0);
    });
  }

  if (dialog) {
    upgradeToModal();

    dialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      closeSheet();
    });

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeSheet();
    });
  }

  document.querySelectorAll("[data-sheet-close]").forEach(function (el) {
    el.addEventListener("click", function (event) {
      event.preventDefault();
      closeSheet();
    });
  });

  document.querySelectorAll("[data-sheet-open]").forEach(function (el) {
    el.addEventListener("click", function (event) {
      if (!dialog) return;
      const mode = el.getAttribute("data-sheet-open");
      if (mode === "create" && form && form.getAttribute("data-sheet-mode") === "create" && dialog.open) {
        event.preventDefault();
        openSheet();
        return;
      }
      if (mode === "edit" && form && form.getAttribute("data-sheet-mode") === "edit") {
        const current = new URLSearchParams(window.location.search).get("editar");
        const target = el.getAttribute("data-user-id");
        if (current && target && current === target && dialog.hasAttribute("open")) {
          event.preventDefault();
          openSheet();
        }
      }
    });
  });

  const startOff = form && form.querySelector("[data-deactivate-start]");
  if (startOff) {
    startOff.addEventListener("click", function (event) {
      event.preventDefault();
      showConfirm(true);
    });
  }
  const cancelOff = form && form.querySelector("[data-deactivate-cancel]");
  if (cancelOff) {
    cancelOff.addEventListener("click", function (event) {
      event.preventDefault();
      showConfirm(false);
    });
  }

  if (filterForm) {
    const search = filterForm.querySelector("input[name='q']");
    let timer = null;
    filterForm.querySelectorAll("select").forEach(function (select) {
      select.addEventListener("change", function () {
        filterForm.submit();
      });
    });
    if (search) {
      search.addEventListener("input", function () {
        if (dialog && dialog.open) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          filterForm.submit();
        }, 280);
      });
    }
  }
})();

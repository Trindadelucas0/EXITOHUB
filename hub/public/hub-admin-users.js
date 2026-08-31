(function () {
  function syncConciEmpresaWrap(form) {
    form.querySelectorAll("[data-conci-role]").forEach(function (select) {
      const panel = select.closest("[data-mod-panel='conci'], .hub-form-footer, form");
      const wrap = panel && panel.querySelector("[data-conci-empresa-wrap]");
      if (!wrap) return;
      wrap.hidden = select.value === "admin";
    });
  }

  function syncModPanels(form) {
    const toggles = form.querySelectorAll("[data-mod-toggle]");
    toggles.forEach(function (input) {
      const mod = input.getAttribute("data-mod-toggle");
      const panel = form.querySelector("[data-mod-panel='" + mod + "']");
      if (!panel) return;
      panel.hidden = !input.checked;
    });
    syncConciEmpresaWrap(form);
  }

  document.querySelectorAll("[data-hub-user-form]").forEach(function (form) {
    form.addEventListener("change", function (event) {
      if (event.target.matches("[data-mod-toggle], [data-conci-role]")) {
        syncModPanels(form);
      }
    });
    syncModPanels(form);
  });
})();

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  active?: "home" | "folha" | "conci" | "ncm" | "admin";
  /** Se true, mostra Admin só quando /api/auth/me indicar isHubAdmin. */
  showAdmin?: boolean;
};

type HubModules = {
  folha: boolean;
  conci: boolean;
  ncm: boolean;
};

const linkClass =
  "flex min-h-11 items-center rounded-[10px] border border-transparent px-3 text-sm font-semibold text-ink hover:bg-paper-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const activeClass = "border-brand bg-brand-soft text-brand";

function apiUrl(path: string) {
  const prefix =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_PATH) ||
    (typeof window !== "undefined" && window.location.pathname.startsWith("/ncm") ? "/ncm" : "") ||
    "";
  if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) return path;
  return `${prefix}${path}`;
}

export function HubSystemsMenu({ active = "ncm", showAdmin = false }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [modules, setModules] = useState<HubModules>({ folha: false, conci: false, ncm: false });
  const [isHubAdmin, setIsHubAdmin] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(apiUrl("/api/auth/me"), { signal: controller.signal, credentials: "same-origin" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const mods = json.data?.modules;
        setModules({
          folha: Boolean(mods?.folha),
          conci: Boolean(mods?.conci),
          ncm: Boolean(mods?.ncm),
        });
        setIsHubAdmin(Boolean(json.data?.isHubAdmin));
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const showFolha = modules.folha;
  const showConci = modules.conci;
  const showNcm = modules.ncm;
  const showFiscal = showConci || showNcm;
  const canShowAdmin = showAdmin && isHubAdmin;

  const panel =
    mounted && open
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[80] bg-ink/45"
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
            />
            <aside
              id="hub-systems-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Sistemas do HUB"
              className="fixed left-0 top-0 z-[90] flex h-dvh w-[min(20rem,92vw)] flex-col overflow-y-auto bg-white p-4 shadow-panel"
            >
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand">Êxito</p>
                  <strong className="block text-base font-extrabold tracking-tight text-ink">Menu</strong>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-line-strong bg-white hover:bg-paper-sunken"
                  aria-label="Fechar menu"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                  }}
                >
                  <span aria-hidden className="text-lg leading-none">
                    ×
                  </span>
                </button>
              </div>

              <nav className="grid gap-4" aria-label="Sistemas">
                <a href="/" className={`${linkClass} ${active === "home" ? activeClass : ""}`}>
                  Início
                </a>

                {showFolha ? (
                  <div className="grid gap-1">
                    <p className="px-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
                      Folha
                    </p>
                    <a href="/folha/dashboard" className={linkClass}>
                      Controle de Folha
                    </a>
                    <a href="/folha/fiscal" className={linkClass}>
                      Fiscal
                    </a>
                  </div>
                ) : null}

                {showFiscal ? (
                  <div className="grid gap-1">
                    <p className="px-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
                      Fiscal
                    </p>
                    {showConci ? (
                      <a
                        href="/conci/"
                        className={`${linkClass} ${active === "conci" ? activeClass : ""}`}
                      >
                        Conciliação
                      </a>
                    ) : null}
                    {showNcm ? (
                      <a
                        href="/ncm/"
                        className={`${linkClass} ${active === "ncm" ? activeClass : ""}`}
                      >
                        Auditor NCM
                      </a>
                    ) : null}
                  </div>
                ) : null}

                {canShowAdmin ? (
                  <div className="grid gap-1">
                    <p className="px-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
                      Administração
                    </p>
                    <a
                      href="/admin/usuarios"
                      className={`${linkClass} ${active === "admin" ? activeClass : ""}`}
                    >
                      Gerenciar usuários
                    </a>
                  </div>
                ) : null}
              </nav>
            </aside>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-line-strong bg-white text-ink hover:bg-paper-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        aria-expanded={open}
        aria-controls="hub-systems-menu"
        aria-label={open ? "Fechar menu de sistemas" : "Abrir menu de sistemas"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex flex-col gap-1" aria-hidden>
          <span className="block h-0.5 w-5 bg-ink" />
          <span className="block h-0.5 w-5 bg-ink" />
          <span className="block h-0.5 w-5 bg-ink" />
        </span>
      </button>
      {panel}
    </>
  );
}

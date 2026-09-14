"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  active?: string;
  /** Mantido por compatibilidade; a API do HUB já filtra por permissão. */
  showAdmin?: boolean;
};

type MenuItem = {
  id: string;
  label: string;
  href: string;
  status: string;
  external?: boolean;
  currentKey: string;
};

type MenuDepartment = {
  id: string;
  label: string;
  items: MenuItem[];
};

const linkClass =
  "flex min-h-11 items-center gap-2 rounded-[10px] border border-transparent px-3 text-sm font-semibold text-ink hover:bg-paper-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const activeClass = "border-brand bg-brand-soft text-brand";

export function HubSystemsMenu({ active = "ncm" }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [departments, setDepartments] = useState<MenuDepartment[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/hub/menu", { signal: controller.signal, credentials: "same-origin" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const next = Array.isArray(json.departments) ? json.departments : [];
        setDepartments(next);
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
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand">Êxito Hub</p>
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

              <nav className="grid gap-1" aria-label="Sistemas">
                <a href="/" className={`${linkClass} ${active === "home" ? activeClass : ""}`}>
                  Início
                </a>

                {departments.map((dept) => {
                  const deptOpen = dept.items.some((item) => item.currentKey === active);
                  return (
                    <details key={dept.id} className="grid gap-1" {...(deptOpen ? { open: true } : {})}>
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-[10px] px-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-muted hover:bg-paper-sunken">
                        {dept.label}
                      </summary>
                      <div className="grid gap-1">
                        {dept.items.map((item) => (
                          <a
                            key={item.id}
                            href={item.href}
                            className={`${linkClass} ${item.currentKey === active ? activeClass : ""}`}
                            {...(item.external
                              ? { target: "_blank", rel: "noopener noreferrer" }
                              : {})}
                          >
                            <span className="min-w-0 flex-1">{item.label}</span>
                            {item.status === "soon" ? (
                              <span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-muted">
                                Em breve
                              </span>
                            ) : null}
                            {item.external ? (
                              <span aria-hidden className="text-ink-muted">
                                ↗
                              </span>
                            ) : null}
                          </a>
                        ))}
                      </div>
                    </details>
                  );
                })}
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

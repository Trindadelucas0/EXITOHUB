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
  icon?: string;
  external?: boolean;
  currentKey: string;
};

type MenuDepartment = {
  id: string;
  label: string;
  items: MenuItem[];
};

const ICON_INNER: Record<string, string> = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  briefcase:
    '<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  "log-in":
    '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  receipt:
    '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M14 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/>',
  "file-text":
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  "bar-chart":
    '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  "git-compare":
    '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/>',
  scale:
    '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  wallet:
    '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2.3"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  droplet:
    '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  calculator:
    '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
  plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8Z"/>',
  clipboard:
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  megaphone: '<path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  network:
    '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
  settings:
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  headset:
    '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>',
  calendar:
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
};

function MenuIcon({ name }: { name: string }) {
  const html = ICON_INNER[name] || ICON_INNER["file-text"];
  return (
    <svg
      className="size-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function itemClass(active: boolean, soon: boolean, indented: boolean) {
  const base =
    "flex min-h-11 items-center gap-3 rounded-md border border-transparent px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  const pad = indented ? "pl-9" : "";
  if (active) return `${base} ${pad} bg-brand text-white hover:bg-brand-hover`;
  if (soon) return `${base} ${pad} text-ink-muted hover:bg-paper-sunken hover:text-ink`;
  return `${base} ${pad} text-ink hover:bg-paper-sunken`;
}

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
                <a href="/" className={itemClass(active === "home", false, false)}>
                  <MenuIcon name="home" />
                  <span className="min-w-0 flex-1">Início</span>
                </a>

                {departments.map((dept) => {
                  const deptOpen = dept.items.some((item) => item.currentKey === active);
                  return (
                    <details
                      key={dept.id}
                      className="group grid gap-0.5"
                      {...(deptOpen ? { open: true } : {})}
                      onToggle={(event) => {
                        const target = event.currentTarget;
                        if (!target.open) return;
                        const nav = target.closest("nav");
                        nav?.querySelectorAll("details").forEach((el) => {
                          if (el !== target) el.open = false;
                        });
                      }}
                    >
                      <summary className="flex min-h-11 w-full cursor-pointer list-none items-center gap-2 rounded-md px-3 text-sm font-semibold text-ink-muted hover:bg-paper-sunken hover:text-ink [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                        <svg
                          className="size-4 shrink-0 transition-transform group-open:rotate-90"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="m9 18 6-6-6-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>{dept.label}</span>
                      </summary>
                      <div className="grid gap-0.5">
                        {dept.items.map((item) => {
                          const isActive = item.currentKey === active;
                          const soon = item.status === "soon";
                          return (
                            <a
                              key={item.id}
                              href={item.href}
                              className={itemClass(isActive, soon, true)}
                              {...(item.external
                                ? { target: "_blank", rel: "noopener noreferrer" }
                                : {})}
                            >
                              <MenuIcon name={item.icon || "file-text"} />
                              <span className="min-w-0 flex-1">{item.label}</span>
                              {soon ? (
                                <span className="shrink-0 whitespace-nowrap rounded-full bg-paper-sunken px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-muted">
                                  Em breve
                                </span>
                              ) : null}
                              {item.external ? (
                                <svg
                                  className="size-4 shrink-0"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  aria-hidden
                                >
                                  <path
                                    d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              ) : null}
                            </a>
                          );
                        })}
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

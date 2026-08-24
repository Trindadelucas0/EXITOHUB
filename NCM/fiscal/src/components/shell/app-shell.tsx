"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import { ACTIVE_LOTE_EVENT, hrefWithLote, readActiveLote } from "@/src/lib/active-lote";
import { ExitoMark } from "@/src/components/brand/exito-mark";
import { Button } from "@/src/components/ui/button";
import {
  IconBaseFiscal,
  IconComoUsar,
  IconConsultar,
  IconDivergencias,
  IconImportar,
  IconPanorama,
} from "./nav-icons";

type NavItem = {
  href: string;
  label: string;
  admin?: boolean;
  icon: ComponentType<{ className?: string }>;
};

const NAV_GROUPS: { id: string; label: string; items: NavItem[] }[] = [
  {
    id: "visao",
    label: "Visão",
    items: [
      { href: "/dashboard", label: "Panorama", icon: IconPanorama },
      { href: "/como-usar", label: "Como usar", icon: IconComoUsar },
    ],
  },
  {
    id: "cadastro",
    label: "Cadastro",
    items: [
      { href: "/consulta", label: "Consultar", icon: IconConsultar },
      { href: "/divergencias", label: "Divergências", icon: IconDivergencias },
      { href: "/base-fiscal", label: "Base fiscal", icon: IconBaseFiscal },
      { href: "/importar", label: "Importar produtos", admin: true, icon: IconImportar },
    ],
  },
];

type Me = {
  name: string;
  email: string;
  role: "admin" | "consulta" | "superadmin";
  companyName: string | null;
  fromOffice: boolean;
  canWrite: boolean;
  hubMode?: boolean;
};

function apiUrl(path: string) {
  const base =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_PATH) ||
    (typeof window !== "undefined" && (window as unknown as { __NEXT_DATA__?: { runtimeConfig?: { basePath?: string } } }).__NEXT_DATA__?.runtimeConfig?.basePath) ||
    "";
  // basePath do Next: quando a página está em /ncm/*, preferir prefixo conhecido em hub
  const prefix = base || (typeof window !== "undefined" && window.location.pathname.startsWith("/ncm") ? "/ncm" : "");
  return `${prefix}${path}`;
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [lote, setLote] = useState("");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const sync = () => setLote(readActiveLote() ?? "");
    sync();
    window.addEventListener(ACTIVE_LOTE_EVENT, sync);
    return () => window.removeEventListener(ACTIVE_LOTE_EVENT, sync);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(apiUrl("/api/auth/me"), { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (res.status === 401) {
          if (typeof window !== "undefined" && window.location.pathname.startsWith("/ncm")) {
            window.location.href = "/login";
          } else {
            router.push("/login");
          }
          return;
        }
        if (!res.ok) {
          throw new Error(json.error?.message ?? "Não foi possível validar a sessão");
        }
        setMe(json.data);
        setError("");
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Falha de rede. Se o servidor estiver reiniciando, aguarde e recarregue.");
      });
    return () => controller.abort();
  }, [router]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  async function logout() {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
    if (me?.hubMode || (typeof window !== "undefined" && window.location.pathname.startsWith("/ncm"))) {
      window.location.href = "/logout";
      return;
    }
    router.push("/login");
    router.refresh();
  }

  async function backToOffice() {
    setLeaving(true);
    const res = await fetch(apiUrl("/api/auth/clear-company"), { method: "POST" });
    if (!res.ok) {
      setLeaving(false);
      setError("Não foi possível voltar ao escritório.");
      return;
    }
    router.push("/escritorio/empresas");
    router.refresh();
  }

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.admin || me?.canWrite),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen min-w-0">
      {me?.hubMode ? (
        <div className="px-3 pt-3 sm:px-4">
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-3 rounded-[20px] bg-white px-4 py-3 shadow-panel">
            <a href="/" className="leading-tight">
              <span className="block text-base font-extrabold tracking-tight text-ink">Êxito</span>
              <span className="block text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand">HUB</span>
            </a>
            <nav className="flex flex-wrap gap-2 text-sm">
              <a className="inline-flex min-h-10 items-center rounded-[10px] border border-line-strong px-3 hover:bg-paper-sunken" href="/">Início</a>
              <a className="inline-flex min-h-10 items-center rounded-[10px] border border-line-strong px-3 hover:bg-paper-sunken" href="/folha/modulos">Folha</a>
              <a className="inline-flex min-h-10 items-center rounded-[10px] border border-line-strong px-3 hover:bg-paper-sunken" href="/conci/">Conciliação</a>
              <a className="inline-flex min-h-10 items-center rounded-[10px] border border-brand bg-brand-soft px-3 font-medium text-brand" href="/ncm/">NCM</a>
              <a className="inline-flex min-h-10 items-center rounded-[10px] border border-line-strong px-3 hover:bg-paper-sunken" href="/admin/usuarios">Usuários</a>
            </nav>
            <a className="ml-auto inline-flex min-h-10 items-center rounded-[10px] border border-line-strong px-3 text-sm hover:bg-paper-sunken" href="/logout">Sair</a>
          </div>
        </div>
      ) : null}
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-3 focus:py-2">
        Ir para o conteúdo
      </a>
      <header className="sticky top-0 z-50 bg-transparent px-3 pt-3 sm:px-4">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 rounded-[20px] bg-white px-4 py-3 shadow-panel">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-line bg-white md:hidden"
              aria-expanded={open}
              aria-controls="menu-principal"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="sr-only">{open ? "Fechar menu" : "Abrir menu"}</span>
              <span className="flex flex-col gap-1" aria-hidden>
                <span className="block h-0.5 w-5 bg-ink" />
                <span className="block h-0.5 w-5 bg-ink" />
                <span className="block h-0.5 w-5 bg-ink" />
              </span>
            </button>
            <Link
              href={hrefWithLote("/dashboard", lote)}
              className="flex min-w-0 items-center gap-2.5 leading-tight"
            >
              <ExitoMark size={34} priority />
              <span className="block truncate font-display text-base font-extrabold tracking-tight text-ink sm:text-lg">
                Auditor Fiscal
              </span>
            </Link>
          </div>
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <div className="min-w-0 text-right">
              <p className="truncate font-medium text-ink">{me?.companyName ?? "…"}</p>
              <p className="hidden truncate text-ink-muted sm:block">
                {me ? `${me.name} · ${me.role}` : "…"}
              </p>
            </div>
            <Button variant="secondary" className="hidden shrink-0 md:inline-flex" onClick={logout}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      {me?.fromOffice ? (
        <div className="px-3 pt-3 sm:px-4">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 rounded-[20px] bg-white px-4 py-3 shadow-panel sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink">
              Você está em <span className="font-medium">{me.companyName}</span> pelo escritório.
            </p>
            <Button
              variant="secondary"
              className="sm:w-auto"
              disabled={leaving}
              onClick={backToOffice}
            >
              {leaving ? "Voltando…" : "Voltar ao escritório"}
            </Button>
          </div>
        </div>
      ) : null}

      {open ? (
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 top-14 z-40 bg-ink/40 md:hidden"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col md:flex-row md:items-stretch">
        <nav
          id="menu-principal"
          aria-label="Principal"
          className={`${
            open
              ? "fixed left-0 top-14 z-50 flex max-h-[calc(100dvh-3.5rem)] w-[min(18rem,88vw)]"
              : "hidden"
          } flex-col overflow-y-auto rounded-[20px] bg-white px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-panel md:sticky md:top-20 md:z-auto md:m-3 md:flex md:h-[calc(100dvh-6rem)] md:w-60 md:max-h-none md:shrink-0 md:self-start`}
        >
          <div className="grid content-start gap-5">
            {groups.map((group) => (
              <div key={group.id}>
                <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                  {group.label}
                </p>
                <ul className="grid content-start gap-1">
                  {group.items.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={hrefWithLote(item.href, lote)}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpen(false)}
                          className={`flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition ${
                            active
                              ? "bg-brand text-white"
                              : "text-ink hover:bg-brand-soft"
                          }`}
                        >
                          <Icon className="shrink-0" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-6 md:hidden">
            <p className="mb-3 truncate px-3 text-sm text-ink-muted">
              {me ? `${me.name} · ${me.role}` : ""}
            </p>
            <Button variant="secondary" className="w-full" onClick={logout}>
              Sair
            </Button>
          </div>
        </nav>
        <main id="conteudo" className="min-w-0 w-full flex-1 px-3 py-4 sm:px-6 sm:py-6 md:px-8">
          {error ? <p className="mb-4 text-sm text-status-bad">{error}</p> : null}
          {children}
        </main>
      </div>
    </div>
  );
}

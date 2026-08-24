"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import { ExitoMark } from "@/src/components/brand/exito-mark";
import { Button } from "@/src/components/ui/button";
import { IconEmpresas, IconUsuarios } from "./nav-icons";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV: NavItem[] = [
  { href: "/escritorio/empresas", label: "Empresas", icon: IconEmpresas },
  { href: "/escritorio/usuarios", label: "Usuários", icon: IconUsuarios },
];

type Me = {
  name: string;
  email: string;
  role: string;
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function EscritorioShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          throw new Error(json.error?.message ?? "Não foi possível validar a sessão");
        }
        if (json.data?.role !== "superadmin") {
          router.push("/dashboard");
          return;
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
    await fetch("/api/auth/logout", { method: "POST" });
    if (process.env.NEXT_PUBLIC_BASE_PATH === "/ncm" || window.location.pathname.startsWith("/ncm")) {
      window.location.href = "/logout";
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen min-w-0">
      {(process.env.NEXT_PUBLIC_BASE_PATH === "/ncm") ? (
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
            </nav>
            <a className="ml-auto inline-flex min-h-10 items-center rounded-[10px] border border-line-strong px-3 text-sm hover:bg-paper-sunken" href="/logout">Sair</a>
          </div>
        </div>
      ) : null}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-3 focus:py-2"
      >
        Ir para o conteúdo
      </a>
      <header className="sticky top-0 z-50 bg-transparent px-3 pt-3 sm:px-4">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 rounded-[20px] bg-white px-4 py-3 shadow-panel">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-line bg-white md:hidden"
              aria-expanded={open}
              aria-controls="menu-escritorio"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="sr-only">{open ? "Fechar menu" : "Abrir menu"}</span>
              <span className="flex flex-col gap-1" aria-hidden>
                <span className="block h-0.5 w-5 bg-ink" />
                <span className="block h-0.5 w-5 bg-ink" />
                <span className="block h-0.5 w-5 bg-ink" />
              </span>
            </button>
            <Link href="/escritorio/empresas" className="flex min-w-0 items-center gap-2.5 leading-tight">
              <ExitoMark size={34} priority />
              <span className="min-w-0">
                <span className="block text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand">
                  Escritório
                </span>
                <span className="block truncate font-display text-base font-extrabold tracking-tight text-ink sm:text-lg">
                  Administrador
                </span>
              </span>
            </Link>
          </div>
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <div className="min-w-0 text-right">
              <p className="truncate font-medium text-ink">Painel das empresas</p>
              <p className="hidden truncate text-ink-muted sm:block">{me ? me.name : "…"}</p>
            </div>
            <Button variant="secondary" className="hidden shrink-0 md:inline-flex" onClick={logout}>
              Sair
            </Button>
          </div>
        </div>
      </header>

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
          id="menu-escritorio"
          aria-label="Escritório"
          className={`${
            open
              ? "fixed left-0 top-14 z-50 flex max-h-[calc(100dvh-3.5rem)] w-[min(18rem,88vw)]"
              : "hidden"
          } flex-col overflow-y-auto rounded-[20px] bg-white px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-panel md:sticky md:top-20 md:z-auto md:m-3 md:flex md:h-[calc(100dvh-6rem)] md:w-60 md:max-h-none md:shrink-0 md:self-start`}
        >
          <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">Cadastro</p>
          <ul className="grid content-start gap-1">
            {NAV.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition ${
                      active ? "bg-brand text-white" : "text-ink hover:bg-brand-soft"
                    }`}
                  >
                    <Icon className="shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto pt-6 md:hidden">
            <p className="mb-3 truncate px-3 text-sm text-ink-muted">{me?.name ?? ""}</p>
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

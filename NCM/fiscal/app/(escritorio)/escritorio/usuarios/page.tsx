"use client";

import { useEffect, useState } from "react";
import { ncmApiUrl } from "@/src/lib/base-path";
import { Notice } from "@/src/components/ui/notice";
import { PageHeader } from "@/src/components/ui/page-header";

type CompanyRow = { id: string; name: string; slug: string };
type UserRow = { id: string; name: string; email: string; role: "admin" | "consulta"; createdAt: string };

export default function EscritorioUsuariosPage() {
  const [forbidden, setForbidden] = useState(false);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCompanies() {
    const me = await fetch(ncmApiUrl("/api/auth/me"), { credentials: "same-origin" }).then((r) => r.json());
    if (me.data?.role !== "superadmin") {
      setForbidden(true);
      return;
    }
    const res = await fetch(ncmApiUrl("/api/companies"), { credentials: "same-origin" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? "Falha ao listar empresas.");
    const list = (json.data.companies ?? []) as CompanyRow[];
    setCompanies(list);
    setCompanyId((current) => current || list[0]?.id || "");
  }

  async function loadUsers(id: string) {
    if (!id) {
      setUsers([]);
      return;
    }
    const res = await fetch(ncmApiUrl(`/api/users?companyId=${encodeURIComponent(id)}`), {
      credentials: "same-origin",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? "Falha ao listar usuários.");
    setUsers(json.data.users ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    loadCompanies()
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    loadUsers(companyId).catch((err: Error) => {
      if (!cancelled) setError(err.message);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (forbidden) {
    return (
      <p className="text-sm text-status-bad">Somente o administrador do escritório consulta usuários de qualquer empresa.</p>
    );
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        kicker="Escritório"
        title="Usuários"
        description="Cadastro centralizado no EXITO HUB. Crie empresas aqui; vincule usuários em /admin/usuarios com módulo NCM."
      />

      <Notice variant="info">
        Novos logins são criados em{" "}
        <a href="/admin/usuarios" className="font-semibold text-brand underline">
          /admin/usuarios
        </a>
        . Selecione o módulo NCM, a empresa e o papel (consulta ou admin).
      </Notice>

      {error ? <Notice variant="error">{error}</Notice> : null}

      <section className="grid w-full max-w-xl gap-4">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-ink">Empresa</span>
          <select
            name="companyId"
            disabled={companies.length === 0}
            className="min-h-11 rounded-[10px] border-0 bg-paper-sunken px-3"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            {companies.length === 0 ? (
              <option value="">Cadastre uma empresa primeiro</option>
            ) : (
              companies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))
            )}
          </select>
        </label>
      </section>

      <section>
        <h2 className="font-display text-xl font-extrabold text-ink">Usuários da empresa</h2>
        {loading ? <p className="mt-2 text-sm text-ink-muted">Carregando…</p> : null}
        {!loading && users.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nenhum usuário nesta empresa.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg bg-white shadow-panel">
            {users.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-ink">{item.name}</p>
                  <p className="text-sm text-ink-muted">{item.email}</p>
                </div>
                <p className="text-sm text-ink-muted">{item.role}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

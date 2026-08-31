"use client";

import { useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Field } from "@/src/components/ui/field";
import { Notice } from "@/src/components/ui/notice";
import { PageHeader } from "@/src/components/ui/page-header";

type CompanyRow = { id: string; name: string; slug: string; createdAt: string };

function ncmPrefix() {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/ncm")) {
    return "/ncm";
  }
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}

function apiUrl(path: string) {
  const prefix = ncmPrefix();
  if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) return path;
  return `${prefix}${path}`;
}

export default function EscritorioEmpresasPage() {
  const [forbidden, setForbidden] = useState(false);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [entering, setEntering] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const fromQuery = params.get("erro");
      if (fromQuery) setError(fromQuery);

      const me = await fetch(apiUrl("/api/auth/me"), { credentials: "same-origin" }).then((r) => r.json());
      if (me.data?.role !== "superadmin") {
        setForbidden(true);
        return;
      }
      const res = await fetch(apiUrl("/api/companies"), { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Falha ao listar empresas.");
      setCompanies(json.data.companies ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(apiUrl("/api/companies"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
        signal: AbortSignal.timeout(20000),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error?.message ?? "Não foi possível cadastrar.");
      setSuccess(
        `Empresa “${json.data.company.name}” criada. Cadastre o login em /admin/usuarios (módulo NCM + esta empresa).`,
      );
      setName("");
      setSlug("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  async function enterCompany(companyId: string) {
    if (entering) return;
    setEntering(companyId);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/auth/select-company"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
        signal: AbortSignal.timeout(20000),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Não foi possível abrir a empresa.");
      }
      const dest = typeof json.data?.redirectTo === "string" ? json.data.redirectTo : "/dashboard";
      window.location.assign(apiUrl(dest));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir a empresa.");
      setEntering("");
    }
  }

  if (forbidden) {
    return (
      <p className="text-sm text-status-bad">Somente o administrador do escritório cadastra empresas.</p>
    );
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        kicker="Escritório"
        title="Empresas"
        description="Cadastre a empresa aqui. O login da equipe é criado em /admin/usuarios (HUB) com módulo NCM vinculado à empresa."
      />
      <Notice variant="warn">
        Usuários NCM são criados em{" "}
        <a href="/admin/usuarios" className="font-semibold text-brand underline">
          /admin/usuarios
        </a>
        .
      </Notice>
      <form
        onSubmit={onSubmit}
        className="grid w-full max-w-xl gap-4 rounded-lg bg-white p-4 shadow-panel sm:p-6"
      >
        <Field label="Nome da empresa" name="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field
          label="Identificador (slug)"
          name="slug"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="ex.: unica"
        />
        <p className="text-xs text-ink-muted">Letras minúsculas, números e hífen.</p>
        {error ? <Notice variant="error">{error}</Notice> : null}
        {success ? <Notice variant="success">{success}</Notice> : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Cadastrando…" : "Cadastrar empresa"}
        </Button>
      </form>
      <section>
        <h2 className="font-display text-xl font-extrabold text-ink">Empresas cadastradas</h2>
        {error ? (
          <div className="mt-2">
            <Notice variant="error">{error}</Notice>
          </div>
        ) : null}
        {loading ? <p className="mt-2 text-sm text-ink-muted">Carregando…</p> : null}
        {!loading && companies.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nenhuma empresa listada.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg bg-white shadow-panel">
            {companies.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-ink">{item.name}</p>
                  <p className="text-sm text-ink-muted">{item.slug}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="sm:w-auto"
                  disabled={entering !== ""}
                  onClick={() => void enterCompany(item.id)}
                >
                  {entering === item.id ? "Abrindo…" : "Entrar"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Field } from "@/src/components/ui/field";
import { Notice } from "@/src/components/ui/notice";
import { PageHeader } from "@/src/components/ui/page-header";

type CompanyRow = { id: string; name: string; slug: string; createdAt: string };

export default function EscritorioEmpresasPage() {
  const router = useRouter();
  const [forbidden, setForbidden] = useState(false);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [entering, setEntering] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const me = await fetch("/api/auth/me").then((r) => r.json());
      if (me.data?.role !== "superadmin") {
        setForbidden(true);
        return;
      }
      const res = await fetch("/api/companies");
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

  async function enterCompany(company: CompanyRow) {
    setEntering(company.id);
    setError("");
    try {
      const res = await fetch("/api/auth/select-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Não foi possível abrir a empresa.");
      router.push(typeof json.data.redirectTo === "string" ? json.data.redirectTo : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir a empresa.");
      setEntering("");
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, adminName, adminEmail, adminPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Não foi possível cadastrar.");
      setSuccess(
        `Empresa “${json.data.company.name}” criada. Entre com ${json.data.admin.email} para abrir o painel fiscal dela.`,
      );
      setName("");
      setSlug("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cadastrar.");
    } finally {
      setSaving(false);
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
        description="Cadastre a empresa e o primeiro administrador. Cada empresa fica isolada: “Entrar” abre a conferência dela sem misturar dados."
      />
      <form
        onSubmit={onSubmit}
        className="grid w-full max-w-xl gap-4 rounded-lg border border-line bg-white p-4 sm:p-6"
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
        <Field
          label="Nome do administrador"
          name="adminName"
          required
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
        />
        <Field
          label="E-mail do administrador"
          name="adminEmail"
          type="email"
          required
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
        />
        <Field
          label="Senha do administrador"
          name="adminPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
        />
        {error ? <Notice variant="error">{error}</Notice> : null}
        {success ? <Notice variant="success">{success}</Notice> : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Cadastrando…" : "Cadastrar empresa"}
        </Button>
      </form>
      <section>
        <h2 className="font-display text-xl text-ink">Empresas cadastradas</h2>
        {loading ? <p className="mt-2 text-sm text-ink-muted">Carregando…</p> : null}
        {!loading && companies.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nenhuma empresa listada.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
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
                  variant="secondary"
                  className="sm:w-auto"
                  disabled={entering !== ""}
                  onClick={() => void enterCompany(item)}
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

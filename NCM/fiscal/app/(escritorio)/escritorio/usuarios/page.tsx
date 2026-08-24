"use client";

import { useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Field } from "@/src/components/ui/field";
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
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "consulta">("consulta");

  async function loadCompanies() {
    const me = await fetch("/api/auth/me").then((r) => r.json());
    if (me.data?.role !== "superadmin") {
      setForbidden(true);
      return;
    }
    const res = await fetch("/api/companies");
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
    const res = await fetch(`/api/users?companyId=${encodeURIComponent(id)}`);
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

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, companyId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Não foi possível cadastrar.");
      setSuccess(`Usuário ${json.data.user.email} cadastrado.`);
      setName("");
      setEmail("");
      setPassword("");
      setRole("consulta");
      await loadUsers(companyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  if (forbidden) {
    return (
      <p className="text-sm text-status-bad">Somente o administrador do escritório cadastra usuários de qualquer empresa.</p>
    );
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        kicker="Escritório"
        title="Usuários"
        description="Escolha a empresa e cadastre o login dela. E-mail é único no sistema."
      />
      <form
        onSubmit={onSubmit}
        className="grid w-full max-w-xl gap-4 rounded-lg border border-line bg-white p-4 sm:p-6"
      >
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-ink">Empresa</span>
          <select
            name="companyId"
            required
            disabled={companies.length === 0}
            className="min-h-11 rounded-md border border-line-strong bg-white px-3"
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
        <Field label="Nome" name="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field
          label="E-mail"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Senha"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-ink">Perfil</span>
          <select
            name="role"
            className="min-h-11 rounded-md border border-line-strong bg-white px-3"
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "consulta")}
          >
            <option value="consulta">Consulta</option>
            <option value="admin">Administrador da empresa</option>
          </select>
        </label>
        {error ? <Notice variant="error">{error}</Notice> : null}
        {success ? <Notice variant="success">{success}</Notice> : null}
        <Button type="submit" disabled={saving || !companyId}>
          {saving ? "Cadastrando…" : "Cadastrar usuário"}
        </Button>
      </form>
      <section>
        <h2 className="font-display text-xl text-ink">Usuários da empresa</h2>
        {loading ? <p className="mt-2 text-sm text-ink-muted">Carregando…</p> : null}
        {!loading && users.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nenhum usuário nesta empresa.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
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

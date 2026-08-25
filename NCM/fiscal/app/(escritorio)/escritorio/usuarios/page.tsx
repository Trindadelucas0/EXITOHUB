"use client";

import { useEffect, useState } from "react";
import { ncmApiUrl } from "@/src/lib/base-path";
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

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(ncmApiUrl("/api/users"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, companyId }),
        signal: AbortSignal.timeout(20000),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error?.message ?? "Não foi possível cadastrar.");
      setSuccess(`Usuário ${json.data.user.email} cadastrado. Login no HUB: cai direto nesta empresa no NCM.`);
      setName("");
      setEmail("");
      setPassword("");
      setRole("consulta");
      await loadUsers(companyId);
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      setError(
        timedOut
          ? "O servidor não respondeu. Recarregue a página e tente de novo."
          : err instanceof Error
            ? err.message
            : "Não foi possível cadastrar.",
      );
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
        description="Cadastre o login da empresa. E-mail e senha são do HUB: ao entrar, a pessoa cai direto na empresa escolhida no NCM."
      />
      <form
        onSubmit={onSubmit}
        className="grid w-full max-w-xl gap-4 rounded-lg bg-white p-4 shadow-panel sm:p-6"
      >
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-ink">Empresa</span>
          <select
            name="companyId"
            required
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
        <Field label="Nome" name="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field
          label="E-mail (login do HUB)"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Senha (login do HUB)"
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
            className="min-h-11 rounded-[10px] border-0 bg-paper-sunken px-3"
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

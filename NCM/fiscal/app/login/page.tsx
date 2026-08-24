"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postLoginPath } from "@/src/lib/auth-home";
import { Button } from "@/src/components/ui/button";
import { Field } from "@/src/components/ui/field";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Não foi possível entrar.");
        return;
      }
      const next = typeof json.data.redirectTo === "string" ? json.data.redirectTo : postLoginPath(json.data.role);
      router.push(next);
      router.refresh();
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] rounded-[20px] bg-white p-8 shadow-panel sm:p-10">
        <div className="flex flex-col items-center text-center">
          <p className="text-[2rem] font-extrabold leading-none tracking-tight text-ink">Êxito</p>
          <h1 className="mt-2 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-brand">
            Auditor Fiscal
          </h1>
        </div>

        <form onSubmit={onSubmit} className="mt-8 grid gap-4">
          <Field
            label="E-mail"
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="Digite seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? (
            <p role="alert" className="text-sm text-status-bad">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={loading} className="w-full min-h-12">
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>

      <p className="mt-8 text-center text-xs text-white/90">© 2026 Êxito - Todos os direitos reservados</p>
    </main>
  );
}

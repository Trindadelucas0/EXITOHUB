import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EscritorioShell } from "@/src/components/shell/escritorio-shell";
import { getCurrentUser } from "@/src/server/auth";

export default async function EscritorioLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "superadmin") {
    redirect("/dashboard");
  }
  return (
    <EscritorioShell>
      <Suspense fallback={<p className="text-sm text-ink-muted">Carregando…</p>}>{children}</Suspense>
    </EscritorioShell>
  );
}

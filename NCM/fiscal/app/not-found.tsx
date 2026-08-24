export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-[20px] bg-white p-8 text-center shadow-panel">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand">Auditor Fiscal</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Página não encontrada</h1>
        <p className="mt-2 text-sm text-ink-muted">
          O endereço não existe ou o registro não pertence à sua empresa.
        </p>
        <a href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-[10px] bg-brand px-4 text-sm font-medium text-white">
          Voltar ao panorama
        </a>
      </div>
    </main>
  );
}

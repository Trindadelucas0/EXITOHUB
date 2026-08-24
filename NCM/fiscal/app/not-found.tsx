export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Auditor Fiscal</p>
        <h1 className="mt-2 font-display text-3xl">Página não encontrada</h1>
        <p className="mt-2 text-sm text-ink-muted">
          O endereço não existe ou o registro não pertence à sua empresa.
        </p>
        <a href="/dashboard" className="mt-6 inline-block text-sm underline">
          Voltar ao panorama
        </a>
      </div>
    </main>
  );
}

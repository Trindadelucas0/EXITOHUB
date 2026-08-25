"use client";

import { useEffect, useState } from "react";
import { BatchDiffPanel } from "@/src/components/product/batch-diff-panel";
import { Button } from "@/src/components/ui/button";
import { Notice } from "@/src/components/ui/notice";
import { PageHeader } from "@/src/components/ui/page-header";
import { clearImportListCache, type BatchOption } from "@/src/components/product/batch-selector";
import { ncmApiUrl } from "@/src/lib/base-path";

export default function ImportarPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [canWrite, setCanWrite] = useState<boolean | null>(null);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [keepTreated, setKeepTreated] = useState(true);

  async function loadBatches() {
    const res = await fetch(ncmApiUrl("/api/import"));
    const json = await res.json();
    if (res.ok) setBatches(json.data.batches ?? []);
  }

  useEffect(() => {
    fetch(ncmApiUrl("/api/auth/me"))
      .then((r) => r.json())
      .then((json) => {
        setCanWrite(Boolean(json.data?.canWrite));
      })
      .catch(() => setCanWrite(false));
    void loadBatches();
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    if (!file) {
      setStatus("error");
      setMessage("Selecione um arquivo XLSX, CSV ou ODS.");
      return;
    }
    setStatus("loading");
    const body = new FormData();
    body.append("file", file);
    body.append("manterTratados", keepTreated ? "1" : "0");
    try {
      const res = await fetch(ncmApiUrl("/api/import"), { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(json.error?.message ?? "Falha na importação.");
        return;
      }
      setStatus("ok");
      setMessage(
        `${json.data.imported} produtos importados neste lote. A base NCM permanece com ${json.data.rulesStillThere} regras. Lotes anteriores foram mantidos.`,
      );
      setFile(null);
      clearImportListCache();
      await loadBatches();
    } catch {
      setStatus("error");
      setMessage("Falha de rede.");
    }
  }

  async function apagar(id: string, fileName: string) {
    if (!canWrite) return;
    if (!window.confirm(`Apagar o lote “${fileName}”? A base fiscal da empresa não será alterada.`)) {
      return;
    }
    setDeleting(id);
    try {
      const res = await fetch(ncmApiUrl(`/api/import/${id}`), { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(json.error?.message ?? "Não foi possível apagar o lote.");
        return;
      }
      clearImportListCache();
      await loadBatches();
    } finally {
      setDeleting(null);
    }
  }

  if (canWrite === null) {
    return <p className="text-sm text-ink-muted">Carregando…</p>;
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        kicker="Cadastro atual"
        title={canWrite ? "Importar produtos" : "Planilhas importadas"}
        description={
          canWrite
            ? "Cada planilha vira um lote separado. A conferência (como está × como deve ficar) usa só o lote escolhido. A base fiscal da empresa não é substituída."
            : "Você pode ver e consultar os lotes já importados. Só o administrador da empresa importa ou apaga planilhas."
        }
      />

      {!canWrite ? (
        <Notice variant="warn">
          Perfil de consulta: apenas visualização. Importar e apagar lotes é exclusivo do administrador.
        </Notice>
      ) : null}

      {canWrite ? (
        <form
          onSubmit={onSubmit}
          className="w-full max-w-xl rounded-lg border border-line bg-white p-4 shadow-panel sm:p-6"
        >
          <label htmlFor="arquivo" className="text-sm font-medium text-ink">
            Arquivo (XLSX, CSV ou ODS, até 8 MB)
          </label>
          <input
            id="arquivo"
            name="arquivo"
            type="file"
            accept=".xlsx,.csv,.ods"
            className="mt-2 block w-full text-base md:text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="mt-3 text-xs text-ink-muted">
            Aceita vários layouts no mesmo fluxo: Santri/genérico (codigo, descricao, ncm, CST por
            destinatário, CST compra, alíquota, IVA/MVA, CEST) e CSV Unica (Cód.Item, Novo NCM /
            Classif. IPI, Desc. Abrev. ICMS). Cada arquivo vira um lote separado na conferência.
          </p>
          {batches.length > 0 ? (
            <label className="mt-4 flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={keepTreated}
                onChange={(event) => setKeepTreated(event.target.checked)}
              />
              <span>
                Trazer “já tratado” do lote anterior (mesmo código). Itens que ficarem corretos não
                copiam a marca. Se a situação fiscal mudar, o item aparece como tratado desatualizado.
              </span>
            </label>
          ) : null}
          <div className="mt-6">
            <Button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Importando…" : "Importar planilha"}
            </Button>
          </div>
          {status === "ok" ? <Notice variant="success" className="mt-4">{message}</Notice> : null}
          {status === "error" ? <Notice variant="error" className="mt-4">{message}</Notice> : null}
        </form>
      ) : null}

      {!canWrite && status === "error" ? <Notice variant="error">{message}</Notice> : null}

      <section className="grid gap-3">
        <h2 className="font-display text-xl font-extrabold text-ink">Histórico de planilhas</h2>
        {batches[0] ? <BatchDiffPanel lote={batches[0].id} /> : null}
        {batches.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {canWrite
              ? "Ainda não há lote importado nesta empresa."
              : "Ainda não há lote importado nesta empresa. Peça ao administrador para importar a planilha."}
          </p>
        ) : (
          <ul className="grid gap-3">
            {batches.map((batch) => (
              <li
                key={batch.id}
                className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-panel sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-ink">{batch.fileName}</p>
                  <p className="text-sm text-ink-muted">
                    {new Date(batch.createdAt).toLocaleString("pt-BR")} · {batch.totalRows}{" "}
                    produtos
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Correto {batch.corretos} · Divergente {batch.divergentes} · Análise{" "}
                    {batch.analise}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`/consulta?lote=${batch.id}`}>
                    <Button type="button" variant="secondary" className="w-full sm:w-auto">
                      Ver conferência
                    </Button>
                  </a>
                  {canWrite ? (
                    <Button
                      type="button"
                      variant="danger"
                      className="w-full sm:w-auto"
                      disabled={deleting === batch.id}
                      onClick={() => void apagar(batch.id, batch.fileName)}
                    >
                      {deleting === batch.id ? "Apagando…" : "Apagar lote"}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

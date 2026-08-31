"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CstMatrix, type MatrixExtraRow } from "@/src/components/matrix/cst-matrix";
import { DiffTable } from "@/src/components/product/diff-table";
import { Button } from "@/src/components/ui/button";
import { PageHeader } from "@/src/components/ui/page-header";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { ncmApiUrl } from "@/src/lib/base-path";
import { DESTINO_KEYS, isUnicaSituacao, type DestinosCst, type FieldDiff, type StatusFiscal } from "@/src/lib/fiscal";

type Payload = {
  product: {
    id: string;
    codigo: string;
    descricao: string;
    ncm: string;
    destinosCst: DestinosCst | null;
    cstUnico: string | null;
    cstCompra: string | null;
    ivaMva: string | null;
    cest?: string | null;
    abreviacao?: string | null;
    aliquotaIcms?: string | null;
    treated: boolean;
    treatedStale: boolean;
    treatedNote: string | null;
  };
  compare: {
    status: StatusFiscal;
    motivo: string;
    diffs: FieldDiff[];
    needsLink: boolean;
    rule: {
      id: string;
      situacaoCodigo: string;
      cstEntrada: string | null;
      cstSaida: string | null;
      cfopSaida: string | null;
      destinosCst: DestinosCst;
      mvaTexto: string | null;
      mvaPercentual: number | null;
      cest?: string | null;
      abreviacao?: string | null;
      ufTributacao?: { DF?: { aliqInterna?: string | null } } | null;
    } | null;
    candidates: { id: string; situacaoCodigo: string; cstSaida: string | null }[];
  };
  guide: {
    ncm: string;
    destaqueStInterno: string | null;
    cfopEntradaNota: string;
    checklist: string[];
    alertaDivergencia: string | null;
    matriz: { destino: string; cst: string }[];
    cstEntrada: string;
    cstBaifer: string;
    cfopSaida: string;
    mva: string;
    situacao: string;
  } | null;
};

export function ProductFicha({ mode }: { mode: "ficha" | "entrada" }) {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [role, setRole] = useState<"admin" | "consulta">("consulta");
  const [saving, setSaving] = useState(false);

  async function load(signal?: AbortSignal) {
    const res = await fetch(ncmApiUrl(`/api/products/${params.id}`), { signal });
    const json = await res.json();
    if (signal?.aborted) return;
    if (!res.ok) throw new Error(json.error?.message ?? "Não encontrado");
    setData(json.data);
  }

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData(null);
    fetch(ncmApiUrl("/api/auth/me"), { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => setRole(json.data?.canWrite ? "admin" : "consulta"))
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
      });
    load(controller.signal).catch((err: Error) => {
      if (err.name === "AbortError") return;
      setError(err.message);
    });
    return () => controller.abort();
  }, [params.id]);

  async function marcarTratado(treated: boolean) {
    setSaving(true);
    try {
      const res = await fetch(ncmApiUrl(`/api/products/${params.id}/treated`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treated }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Falha ao marcar");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setSaving(false);
    }
  }

  async function vincular(ruleId: string) {
    setSaving(true);
    try {
      const res = await fetch(ncmApiUrl(`/api/products/${params.id}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Falha ao vincular");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return <p className="text-sm text-status-bad">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-ink-muted">Carregando ficha…</p>;
  }

  const title = mode === "entrada" ? "Como dar entrada?" : "Consulta fiscal do produto";
  const unica = isUnicaSituacao(data.compare.rule?.situacaoCodigo);
  const showDestinos =
    !unica && (hasDestinos(data.product.destinosCst) || Boolean(data.compare.rule?.destinosCst));

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker={data.product.codigo}
        title={title}
        description={data.product.descricao}
        actions={
          <>
            <Link href={`/consulta/${data.product.id}`} className="w-full sm:w-auto">
              <Button variant={mode === "ficha" ? "primary" : "secondary"} className="w-full sm:w-auto">
                Ficha
              </Button>
            </Link>
            <Link href={`/como-dar-entrada/${data.product.id}`} className="w-full sm:w-auto">
              <Button variant={mode === "entrada" ? "primary" : "secondary"} className="w-full sm:w-auto">
                Como dar entrada
              </Button>
            </Link>
          </>
        }
      />

      <section className="grid gap-4 rounded-lg border border-line bg-white p-4 shadow-panel sm:p-5">
        <p className="rounded-md border border-line bg-paper-sunken px-3 py-2 text-sm text-ink-muted">
          A tributação correta não vem do cadastro importado. Vem da regra fiscal da empresa: um NCM, uma
          regra, para todos os produtos daquele NCM. Se o NCM no ERP estiver errado, CST, MVA e a entrada saem
          errados juntos.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={data.compare.status} />
          <p className="text-sm text-ink-muted">NCM {data.product.ncm}</p>
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => void marcarTratado(!data.product.treated)}
          >
            {data.product.treated ? "Desmarcar tratado" : "Marcar como já tratado"}
          </Button>
        </div>
        {data.product.treated ? (
          <p className="text-sm text-ink-muted">
            {data.product.treatedStale
              ? "Tratado no lote anterior — a situação fiscal mudou. Confira de novo ou desmarque."
              : "Já tratado: os valores da regra foram copiados para este produto e o status passou a correto."}
          </p>
        ) : (
          <p className="text-sm text-ink-muted">
            Ao marcar como tratado, o sistema copia os valores corretos da regra fiscal para este
            produto.
          </p>
        )}
        <p className="text-sm text-ink">{data.compare.motivo}</p>
      </section>

      {data.compare.needsLink ? (
        <div className="rounded-lg border border-status-warn bg-status-warn-bg p-4">
          <p className="font-medium">Este NCM tem duas regras. Escolha a hipótese.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.compare.candidates.map((c) => (
              <Button
                key={c.id}
                variant="secondary"
                disabled={saving || role !== "admin"}
                onClick={() => vincular(c.id)}
              >
                Vincular {c.situacaoCodigo} (CST {c.cstSaida ?? "—"})
              </Button>
            ))}
          </div>
          {role !== "admin" ? (
            <p className="mt-2 text-sm">Somente administrador pode vincular a regra.</p>
          ) : null}
        </div>
      ) : null}

      {mode === "entrada" && data.compare.diffs.length > 0 ? (
        <section className="grid gap-2 rounded-lg border border-line bg-white p-4 shadow-panel sm:p-5">
          <h2 className="text-sm font-medium text-ink">
            O que veio errado no importado e como deve ficar
          </h2>
          <DiffTable diffs={data.compare.diffs} />
        </section>
      ) : null}

      {mode === "ficha" ? (
        <section className="grid gap-2 rounded-lg border border-line bg-white p-4 shadow-panel sm:p-5">
          <h2 className="text-sm font-medium text-ink">Como está e como deve ficar</h2>
          <div className="md:hidden">
            <CstMatrix
              layout="stacked"
              ideal={data.compare.rule?.destinosCst}
              atual={data.product.destinosCst}
              extras={fichaExtras(data)}
              showAtual
              showDestinos={showDestinos}
            />
          </div>
          <div className="hidden md:block">
            <CstMatrix
              ideal={data.compare.rule?.destinosCst}
              atual={data.product.destinosCst}
              extras={fichaExtras(data)}
              showAtual
              showDestinos={showDestinos}
            />
          </div>
        </section>
      ) : (
        <section className="grid gap-4 rounded-lg border border-line bg-white p-5 shadow-panel">
          {data.guide?.alertaDivergencia ? (
            <p className="rounded-md bg-status-bad-bg px-3 py-2 text-sm text-status-bad">
              {data.guide.alertaDivergencia}
            </p>
          ) : null}
          {data.guide?.destaqueStInterno ? (
            <p className="rounded-md bg-status-warn-bg px-3 py-2 text-sm">{data.guide.destaqueStInterno}</p>
          ) : null}
          <dl className="grid gap-3 sm:grid-cols-2">
            <Item label="NCM do cadastro (cliente)" value={data.product.ncm || "(vazio)"} />
            <Item label="NCM da regra da empresa" value={data.guide?.ncm ?? "—"} />
            <Item label="Situação" value={data.guide?.situacao ?? "—"} />
            <Item label="CST nota de entrada" value={data.guide?.cstEntrada ?? "—"} emphasis />
            <Item label="CST da empresa (saída)" value={data.guide?.cstBaifer ?? "—"} />
            <Item label="CFOP de saída" value={data.guide?.cfopSaida ?? "—"} />
            <Item label="MVA" value={data.guide?.mva ?? "—"} emphasis />
            <Item label="CFOP de entrada" value={data.guide?.cfopEntradaNota ?? "—"} emphasis />
          </dl>
          <div className="md:hidden">
            <CstMatrix layout="stacked" ideal={data.compare.rule?.destinosCst} showDestinos={showDestinos} extras={unica ? fichaExtras(data) : []} />
          </div>
          <div className="hidden md:block">
            <CstMatrix ideal={data.compare.rule?.destinosCst} showDestinos={showDestinos} extras={unica ? fichaExtras(data) : []} />
          </div>
          <div>
            <h2 className="font-medium text-ink">Checklist na NF do fornecedor</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
              {data.guide?.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function Item({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  if (!emphasis) {
    return (
      <div className="rounded-md border border-line px-3 py-2">
        <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
        <dd className="mt-1 text-sm">{value}</dd>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-brand-line border-l-4 border-l-brand bg-brand-soft px-3 py-2 shadow-brand-sm">
      <dt className="text-xs font-medium uppercase tracking-wide text-status-ok">
        {label} · use este valor
      </dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function hasDestinos(destinos?: DestinosCst | null) {
  return Boolean(destinos && DESTINO_KEYS.some((key) => destinos[key]));
}

function fichaExtras(data: Payload): MatrixExtraRow[] {
  const extras: MatrixExtraRow[] = [];
  const rule = data.compare.rule;
  const product = data.product;
  const diffs = data.compare.diffs;
  const compraDiff = diffs.find((diff) => diff.campo === "CST compra / nota de entrada");
  const saidaDiff = diffs.find((diff) => diff.campo === "CST BAIFER");
  const mvaDiff = diffs.find((diff) => diff.campo === "MVA / IVA");
  const abrevDiff = diffs.find((diff) => diff.campo === "Abreviação");
  const cestDiff = diffs.find((diff) => diff.campo === "CEST");
  const aliqDiff = diffs.find((diff) => diff.campo === "Alíquota interna DF");
  const unica = isUnicaSituacao(rule?.situacaoCodigo);

  if (unica || abrevDiff || product.abreviacao || rule?.abreviacao) {
    extras.push({
      key: "abreviacao",
      label: "Abreviação fiscal",
      atual: abrevDiff?.atual ?? product.abreviacao,
      ideal: abrevDiff?.ideal ?? rule?.abreviacao ?? product.abreviacao,
    });
  }

  if (cestDiff || product.cest) {
    extras.push({
      key: "cest",
      label: "CEST",
      atual: cestDiff?.atual ?? product.cest,
      ideal: cestDiff?.ideal ?? rule?.cest ?? product.cest,
    });
  }

  if (aliqDiff) {
    extras.push({
      key: "aliquota",
      label: "Alíquota interna DF",
      atual: aliqDiff.atual,
      ideal: aliqDiff.ideal,
    });
  }

  if (!unica && (compraDiff || product.cstCompra || rule?.cstEntrada)) {
    extras.push({
      key: "cstCompra",
      label: "CST de compra (entrada)",
      atual: compraDiff?.atual ?? product.cstCompra,
      // Sem valor na regra: mostra o importado (não inventa CST de entrada).
      ideal: compraDiff?.ideal ?? rule?.cstEntrada ?? product.cstCompra,
    });
  }

  if (
    !unica &&
    !hasDestinos(product.destinosCst) &&
    (saidaDiff || product.cstUnico || rule?.cstSaida)
  ) {
    extras.push({
      key: "cstSaida",
      label: "CST da empresa (saída)",
      atual: saidaDiff?.atual ?? product.cstUnico,
      ideal: saidaDiff?.ideal ?? rule?.cstSaida ?? product.cstUnico,
    });
  }

  if (mvaDiff || product.ivaMva || (!unica && (rule?.mvaTexto || rule?.mvaPercentual != null))) {
    const ruleMva =
      rule?.mvaPercentual != null ? String(rule.mvaPercentual) : rule?.mvaTexto ?? null;
    extras.push({
      key: "mva",
      label: "MVA / IVA",
      atual: mvaDiff?.atual ?? product.ivaMva,
      // Sem valor na regra: mostra o importado (não inventa MVA).
      ideal: mvaDiff?.ideal ?? ruleMva ?? product.ivaMva,
    });
  }

  return extras;
}

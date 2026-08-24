import Link from "next/link";
import { DiffTable } from "@/src/components/product/diff-table";
import { Button } from "@/src/components/ui/button";
import { StatusBadge } from "@/src/components/ui/status-badge";
import type { FieldDiff, StatusFiscal } from "@/src/lib/fiscal";

export type DivergenceItem = {
  id: string;
  codigo: string;
  descricao: string;
  ncm: string;
  ncmOriginal: string;
  status: StatusFiscal;
  motivo: string;
  needsLink: boolean;
  situacao: string | null;
  situacaoCodigo: string | null;
  diffs: FieldDiff[];
  importado: {
    cstCompra: string | null;
    cstUnico: string | null;
    ivaMva: string | null;
  };
  correto: {
    ncm: string;
    cstEntrada: string | null;
    cstSaida: string | null;
    cfopSaida: string | null;
    mva: string | null;
    situacao: string;
  } | null;
  candidates: {
    id: string;
    situacao: string;
    situacaoCodigo: string;
    cstSaida: string | null;
    cfopSaida: string | null;
  }[];
};

export function DivergenceCard({ item }: { item: DivergenceItem }) {
  return (
    <article className="rounded-lg border border-line bg-white shadow-panel">
      <header className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
            Código do produto
          </p>
          <h2 className="mt-1 font-display text-2xl tabular text-ink">{item.codigo}</h2>
          <p className="mt-1 text-sm text-ink">{item.descricao}</p>
        </div>
        <StatusBadge status={item.status} />
      </header>

      <dl className="grid gap-3 border-b border-line bg-paper-sunken px-4 py-3 sm:grid-cols-3">
        <Meta
          label="NCM no cadastro"
          value={item.ncmOriginal || item.ncm || "(vazio)"}
        />
        <Meta label="Regra da empresa" value={item.correto?.situacao || item.situacao || "Sem regra"} />
        <Meta
          label="CFOP / CST corretos"
          value={
            item.correto
              ? `CFOP ${item.correto.cfopSaida ?? "—"} · CST ${item.correto.cstSaida ?? "—"}`
              : "—"
          }
        />
      </dl>

      <div className="grid gap-4 p-4">
        {item.needsLink ? (
          <div className="rounded-md border border-status-warn bg-status-warn-bg px-3 py-3 text-sm">
            <p className="font-medium text-status-warn">Este NCM tem duas regras.</p>
            <p className="mt-1 text-ink">
              Vincule a hipótese na ficha antes de corrigir o cadastro. Hipóteses:
            </p>
            <ul className="mt-2 list-disc pl-5">
              {item.candidates.map((candidate) => (
                <li key={candidate.id}>
                  {candidate.situacao || candidate.situacaoCodigo} · CST {candidate.cstSaida ?? "—"} ·
                  CFOP {candidate.cfopSaida ?? "—"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {item.diffs.length > 0 ? (
          <section className="grid gap-2">
            <h3 className="text-sm font-medium text-ink">
              O que veio errado no importado e como deve ficar
            </h3>
            <DiffTable diffs={item.diffs} />
          </section>
        ) : item.status !== "CORRETO" && !item.needsLink ? (
          <p className="text-sm text-ink">{item.motivo}</p>
        ) : item.status === "CORRETO" ? (
          <p className="rounded-md border-l-4 border-brand bg-brand-soft px-3 py-2 text-sm font-medium text-status-ok shadow-brand-sm">
            O cadastro importado bate com a regra deste NCM.
          </p>
        ) : null}

        {item.correto && item.diffs.length > 0 ? (
          <dl className="grid gap-3 rounded-md border border-brand-line border-l-4 border-l-brand bg-brand-soft px-3 py-3 shadow-brand-sm sm:grid-cols-4">
            <Meta label="CST entrada correto" value={item.correto.cstEntrada ?? "—"} />
            <Meta label="CST saída correto" value={item.correto.cstSaida ?? "—"} />
            <Meta label="CFOP saída correto" value={item.correto.cfopSaida ?? "—"} />
            <Meta label="MVA correta" value={item.correto.mva ?? "—"} />
          </dl>
        ) : null}

        <p className="text-xs text-ink-muted">{item.motivo}</p>

        <div className="flex flex-wrap gap-2">
          <Link href={`/consulta/${item.id}`}>
            <Button variant="primary">Ver ficha</Button>
          </Link>
          <Link href={`/como-dar-entrada/${item.id}`}>
            <Button variant="secondary">Como dar entrada</Button>
          </Link>
        </div>
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm tabular text-ink">{value}</dd>
    </div>
  );
}

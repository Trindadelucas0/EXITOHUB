import {
  EGAPLAST_IVA_UF_KEYS,
  ivaCellsDiverge,
  type IvaPorUf,
} from "@/src/lib/iva-por-uf";
import { origemIvaLabel, type OrigemIvaKind } from "@/src/lib/origem-iva";

type EgaplastIvaBlockProps = {
  atual?: IvaPorUf | null;
  ideal?: IvaPorUf | null;
  compare?: boolean;
  compact?: boolean;
  codigo?: string | null;
  origem?: string | null;
  cst?: string | null;
  ncm?: string | null;
  mismatchCodigo?: boolean;
  mismatchOrigem?: boolean;
  mismatchCst?: boolean;
  mismatchNcm?: boolean;
};

function display(value?: string | null): string {
  return value == null || String(value).trim() === "" ? "—" : String(value);
}

export function EgaplastIvaBlock({
  atual,
  ideal,
  compare = false,
  compact = false,
  codigo,
  origem,
  cst,
  ncm,
  mismatchCodigo = false,
  mismatchOrigem = false,
  mismatchCst = false,
  mismatchNcm = false,
}: EgaplastIvaBlockProps) {
  const origemInfo = origemIvaLabel(origem);
  const regraLabel = regraColumnLabel(origemInfo.kind);
  const showMeta = Boolean(codigo || origem || cst || ncm);
  if (compact) {
    const mismatch = compare && ivaCellsDiverge(atual?.SP, ideal?.SP);
    return (
      <span className={`tabular ${mismatch ? "text-status-bad" : "text-ink"}`}>
        SP {display(atual?.SP)}
        <span className="ml-1 text-ink-muted">· {origemInfo.short} · ver ficha</span>
      </span>
    );
  }

  return (
    <div className="grid gap-3">
      {showMeta ? (
        <dl className="grid gap-2 sm:grid-cols-4">
          {codigo ? <Meta label="Código" value={codigo} mismatch={mismatchCodigo} /> : null}
          {origem ? (
            <Meta
              label="Origem"
              value={origemInfo.short}
              hint={origemInfo.detail !== origemInfo.short ? origemInfo.detail : undefined}
              mismatch={mismatchOrigem}
            />
          ) : null}
          {cst ? <Meta label="CST" value={cst} mismatch={mismatchCst} /> : null}
          {ncm ? <Meta label="NCM" value={ncm} mismatch={mismatchNcm} /> : null}
        </dl>
      ) : null}
      <p className="text-sm text-ink-muted">
        IVA/ICMS por UF · esta regra é a de mercadoria {origemInfo.kind === "importado" ? "importada" : "nacional"}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm tabular">
          <caption className="sr-only">
            IVA/ICMS por UF: cadastro do cliente e como deve ficar ({origemInfo.short})
          </caption>
          <thead className="bg-paper-sunken text-ink-muted">
            <tr>
              <th scope="col" className="border border-line px-2 py-1.5 font-medium">
                UF
              </th>
              <th scope="col" className="border border-line px-2 py-1.5 font-medium">
                Cadastro do cliente
              </th>
              <th
                scope="col"
                className="border border-line border-l-2 border-l-brand bg-brand-soft px-2 py-1.5 font-medium text-status-ok"
              >
                {regraLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {EGAPLAST_IVA_UF_KEYS.map((uf) => {
              const cadastro = display(atual?.[uf]);
              const correto = display(ideal?.[uf]);
              const mismatch = compare && ivaCellsDiverge(atual?.[uf], ideal?.[uf]);
              return (
                <tr key={uf}>
                  <th scope="row" className="border border-line px-2 py-1 font-medium text-ink">
                    {uf}
                  </th>
                  <td
                    className={`border border-line px-2 py-1 ${
                      mismatch ? "bg-status-bad-bg text-status-bad" : "bg-white"
                    }`}
                  >
                    {cadastro}
                  </td>
                  <td className="border border-line border-l-2 border-l-brand bg-brand-soft px-2 py-1 font-medium text-ink">
                    {correto}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function regraColumnLabel(kind: OrigemIvaKind): string {
  return kind === "importado" ? "Como deve ficar · Importado" : "Como deve ficar · Nacional";
}

function Meta({
  label,
  value,
  hint,
  mismatch,
}: {
  label: string;
  value: string;
  hint?: string;
  mismatch?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        mismatch ? "border-status-bad bg-status-bad-bg" : "border-line"
      }`}
    >
      <dt className={`text-xs uppercase tracking-wide ${mismatch ? "text-status-bad" : "text-ink-muted"}`}>
        {label}
      </dt>
      <dd className={`mt-1 text-sm ${mismatch ? "font-medium text-status-bad" : "text-ink"}`}>{value}</dd>
      {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

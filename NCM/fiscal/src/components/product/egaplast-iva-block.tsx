import {
  EGAPLAST_IVA_UF_KEYS,
  ivaCellsDiverge,
  type IvaPorUf,
} from "@/src/lib/iva-por-uf";

type EgaplastIvaBlockProps = {
  atual?: IvaPorUf | null;
  ideal?: IvaPorUf | null;
  compare?: boolean;
  matched?: boolean;
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
  const showMeta = Boolean(codigo || origem || cst || ncm);
  if (compact) {
    const mismatch = compare && ivaCellsDiverge(atual?.SP, ideal?.SP);
    return (
      <span className={`tabular ${mismatch ? "text-status-bad" : "text-ink"}`}>
        SP {display(atual?.SP)}
        <span className="ml-1 text-ink-muted">· ver ficha</span>
      </span>
    );
  }

  return (
    <div className="grid gap-3">
      {showMeta ? (
        <dl className="grid gap-2 sm:grid-cols-4">
          {codigo ? <Meta label="Código" value={codigo} mismatch={mismatchCodigo} /> : null}
          {origem ? <Meta label="Origem" value={origem} mismatch={mismatchOrigem} /> : null}
          {cst ? <Meta label="CST" value={cst} mismatch={mismatchCst} /> : null}
          {ncm ? <Meta label="NCM" value={ncm} mismatch={mismatchNcm} /> : null}
        </dl>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm tabular">
          <caption className="sr-only">IVA/ICMS por UF: importado e como deve ficar</caption>
          <thead className="bg-paper-sunken text-ink-muted">
            <tr>
              <th scope="col" className="border border-line px-2 py-1.5 font-medium">
                UF
              </th>
              <th scope="col" className="border border-line px-2 py-1.5 font-medium">
                Importado
              </th>
              <th
                scope="col"
                className="border border-line border-l-2 border-l-brand bg-brand-soft px-2 py-1.5 font-medium text-status-ok"
              >
                Como deve ficar
              </th>
            </tr>
          </thead>
          <tbody>
            {EGAPLAST_IVA_UF_KEYS.map((uf) => {
              const importado = display(atual?.[uf]);
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
                    {importado}
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

function Meta({
  label,
  value,
  mismatch,
}: {
  label: string;
  value: string;
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
    </div>
  );
}

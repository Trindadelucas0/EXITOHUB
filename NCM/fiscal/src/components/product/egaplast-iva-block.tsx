import {
  EGAPLAST_IVA_UF_ROWS,
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
};

function cellValue(
  uf: string,
  atual?: IvaPorUf | null,
  ideal?: IvaPorUf | null,
  matched?: boolean,
): string {
  const source = matched ? (ideal?.[uf] ?? atual?.[uf]) : atual?.[uf];
  const text = source == null || String(source).trim() === "" ? "—" : String(source);
  return text;
}

export function EgaplastIvaBlock({
  atual,
  ideal,
  compare = false,
  matched = false,
  compact = false,
  codigo,
  origem,
  cst,
  ncm,
}: EgaplastIvaBlockProps) {
  const showMeta = Boolean(codigo || origem || cst || ncm);
  return (
    <div className={compact ? "min-w-[16rem]" : "grid gap-3"}>
      {showMeta ? (
        <dl className="grid gap-2 sm:grid-cols-4">
          {codigo ? <Meta label="Código" value={codigo} /> : null}
          {origem ? <Meta label="Origem" value={origem} /> : null}
          {cst ? <Meta label="CST" value={cst} /> : null}
          {ncm ? <Meta label="NCM" value={ncm} /> : null}
        </dl>
      ) : null}
      <div className="overflow-x-auto">
        <table
          className={`w-full border-collapse tabular ${compact ? "text-[10px] leading-tight" : "text-xs sm:text-sm"}`}
        >
          <caption className="sr-only">IVA/ICMS por UF</caption>
          <tbody>
            {EGAPLAST_IVA_UF_ROWS.map((row, index) => (
              <tr key={row.join("-")}>
                {row.map((uf) => {
                  const shown = cellValue(uf, atual, ideal, matched);
                  const mismatch =
                    compare && !matched && ivaCellsDiverge(atual?.[uf], ideal?.[uf]);
                  return (
                    <td
                      key={uf}
                      className={`border border-line px-1 py-0.5 ${
                        mismatch ? "bg-status-bad-bg text-status-bad" : "bg-white"
                      }`}
                      title={mismatch ? `Como deve ficar: ${ideal?.[uf] ?? "—"}` : uf}
                    >
                      <span className="mr-1 font-medium text-ink-muted">{uf}</span>
                      <span>{shown}</span>
                    </td>
                  );
                })}
                {row.length < 7
                  ? Array.from({ length: 7 - row.length }).map((_, empty) => (
                      <td key={`empty-${empty}`} className="border border-line bg-paper-sunken" />
                    ))
                  : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

import { labelCampoFiscal, type FieldDiff } from "@/src/lib/fiscal";

export function DiffTable({ diffs }: { diffs: FieldDiff[] }) {
  if (diffs.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="hidden w-full text-left text-sm md:table">
        <caption className="sr-only">
          Campos errados no cadastro importado e valor correto da regra fiscal
        </caption>
        <thead className="bg-paper-sunken text-ink-muted">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Campo
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Importado (errado)
            </th>
            <th scope="col" className="border-l-2 border-brand bg-brand-soft px-3 py-2.5 font-medium text-status-ok">
              Como deve ficar
            </th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((diff) => (
            <tr key={diff.campo} className="border-t border-line">
              <th scope="row" className="px-3 py-2.5 font-medium text-ink">
                {labelCampoFiscal(diff.campo)}
              </th>
              <td className="bg-status-bad-bg px-3 py-2.5 tabular text-status-bad">
                {diff.atual}
              </td>
              <td className="border-l-2 border-brand bg-brand-soft px-3 py-2.5 font-semibold tabular text-status-ok">
                {diff.ideal}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="grid gap-2 p-3 md:hidden">
        {diffs.map((diff) => (
          <li key={diff.campo} className="rounded-md border border-line bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {labelCampoFiscal(diff.campo)}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-status-bad-bg px-2.5 py-2">
                <dt className="text-xs text-status-bad">Importado</dt>
                <dd className="mt-0.5 tabular font-medium text-status-bad">{diff.atual}</dd>
              </div>
              <div className="rounded-md border-l-4 border-brand bg-brand-soft px-2.5 py-2 shadow-brand-sm">
                <dt className="text-xs text-status-ok">Como deve ficar</dt>
                <dd className="mt-0.5 tabular font-semibold text-status-ok">{diff.ideal}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

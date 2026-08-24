import {
  DESTINO_KEYS,
  DESTINO_LABELS,
  DESTINO_SHORT_LABELS,
  cstCellsDiverge,
  displayCst,
  type DestinosCst,
} from "@/src/lib/fiscal";

export type MatrixExtraRow = {
  key: string;
  label: string;
  atual?: string | null;
  ideal?: string | null;
};

type CstMatrixProps = {
  ideal?: DestinosCst | null;
  atual?: DestinosCst | null;
  extras?: MatrixExtraRow[];
  showAtual?: boolean;
  showDestinos?: boolean;
  layout?: "table" | "stacked";
};

type StackedItem = {
  key: string;
  label: string;
  atual?: string | null;
  ideal?: string | null;
};

export function CstMatrix({
  ideal,
  atual,
  extras = [],
  showAtual,
  showDestinos = true,
  layout = "table",
}: CstMatrixProps) {
  const includeAtual = showAtual ?? Boolean(atual);
  const destinos = showDestinos && (Boolean(atual) || Boolean(ideal) || extras.length === 0);

  if (layout === "stacked") {
    const items: StackedItem[] = [
      ...(destinos
        ? DESTINO_KEYS.map((key) => ({
            key,
            label: DESTINO_LABELS[key],
            atual: atual?.[key] ?? null,
            ideal: ideal?.[key] ?? null,
          }))
        : []),
      ...extras,
    ];

    return (
      <dl className="overflow-hidden rounded-lg border border-line">
        {items.map((item, index) => {
          const mismatch = includeAtual && cstCellsDiverge(item.atual, item.ideal);
          return (
            <div
              key={item.key}
              className={`px-3 py-2.5 ${index > 0 ? "border-t border-line" : ""}`}
            >
              <dt className="text-xs uppercase tracking-wide text-ink-muted">{item.label}</dt>
              {includeAtual ? (
                <dd className="mt-1 grid gap-1 text-sm">
                  <span
                    className={`rounded-sm px-1.5 py-0.5 tabular ${
                      mismatch ? "bg-status-bad-bg text-status-bad" : ""
                    }`}
                  >
                    Importado: {displayCst(item.atual)}
                  </span>
                  <span className="rounded-sm border-l-2 border-brand bg-brand-soft px-1.5 py-0.5 font-medium tabular text-status-ok">
                    Como deve ficar: {displayCst(item.ideal)}
                  </span>
                </dd>
              ) : (
                <dd className="mt-1 w-fit rounded-sm border-l-2 border-brand bg-brand-soft px-1.5 py-0.5 text-sm font-medium tabular text-status-ok">
                  {displayCst(item.ideal)}
                </dd>
              )}
            </div>
          );
        })}
      </dl>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border border-line">
      <table className="fiscal-grid w-full text-left">
        <caption className="sr-only">Matriz CST por destinatário</caption>
        <thead>
          <tr>
            <th className="sticky-col sticky-col-1">Origem</th>
            {destinos
              ? DESTINO_KEYS.map((key) => (
                  <th key={key}>{DESTINO_SHORT_LABELS[key]}</th>
                ))
              : null}
            {extras.map((extra) => (
              <th key={extra.key}>{extra.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {includeAtual ? (
            <tr>
              <th scope="row" className="sticky-col sticky-col-1 font-medium">
                Importado
              </th>
              {destinos
                ? DESTINO_KEYS.map((key) => {
                    const imported = atual?.[key] ?? null;
                    const correct = ideal?.[key] ?? null;
                    const mismatch = cstCellsDiverge(imported, correct);
                    return (
                      <td
                        key={key}
                        className={`tabular ${mismatch ? "bg-status-bad-bg text-status-bad" : ""}`}
                      >
                        {displayCst(imported)}
                      </td>
                    );
                  })
                : null}
              {extras.map((extra) => {
                const mismatch = cstCellsDiverge(extra.atual, extra.ideal);
                return (
                  <td
                    key={extra.key}
                    className={`tabular ${mismatch ? "bg-status-bad-bg text-status-bad" : ""}`}
                  >
                    {displayCst(extra.atual)}
                  </td>
                );
              })}
            </tr>
          ) : null}
          <tr className="linha-destaque">
            <th scope="row" className="sticky-col sticky-col-1 font-medium">
              Como deve ficar
            </th>
            {destinos
              ? DESTINO_KEYS.map((key) => {
                  const imported = atual?.[key] ?? null;
                  const correct = ideal?.[key] ?? null;
                  const mismatch = includeAtual && cstCellsDiverge(imported, correct);
                  return (
                    <td
                      key={key}
                      className={`tabular ${mismatch ? "font-semibold text-status-ok ring-1 ring-inset ring-brand" : ""}`}
                    >
                      {displayCst(correct)}
                    </td>
                  );
                })
              : null}
            {extras.map((extra) => {
              const mismatch = includeAtual && cstCellsDiverge(extra.atual, extra.ideal);
              return (
                <td
                  key={extra.key}
                  className={`tabular ${mismatch ? "font-semibold text-status-ok ring-1 ring-inset ring-brand" : ""}`}
                >
                  {displayCst(extra.ideal)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

import { CstCell } from "@/src/components/grid/cst-cell";
import type { FiscalColumn } from "@/src/components/grid/fiscal-grid";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { DESTINO_KEYS, DESTINO_SHORT_LABELS } from "@/src/lib/fiscal";
import type { ProductSheetItem } from "./product-sheet-types";

export const PRODUCT_SHEET_COLUMNS: FiscalColumn<ProductSheetItem>[] = [
  {
    id: "codigo",
    header: "Código",
    sticky: 1,
    className: "min-w-[6.75rem] max-w-[6.75rem] font-medium tabular",
    cell: (row) => row.codigo,
  },
  {
    id: "descricao",
    header: "Descrição",
    sticky: 2,
    className: "min-w-[10rem] max-w-[14rem] truncate sm:min-w-[14rem]",
    cell: (row) => <span title={row.descricao}>{row.descricao}</span>,
  },
  {
    id: "ncm",
    header: "NCM",
    sticky: 3,
    className: "min-w-[6.5rem] tabular",
    cell: (row) => row.ncm || "(vazio)",
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1">
        <StatusBadge status={row.status} />
        {row.treated ? (
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">
            {row.treatedStale ? "tratado*" : "tratado"}
          </span>
        ) : null}
      </span>
    ),
  },
  {
    id: "situacao",
    header: "Situação",
    show: "md",
    cell: (row) => row.situacaoCodigo || row.situacao || "—",
  },
  {
    id: "cstEntrada",
    header: "CST entrada",
    show: "md",
    cell: (row) => (
      <CstCell compare atual={row.importado.cstCompra} ideal={row.correto?.cstEntrada} />
    ),
  },
  {
    id: "cstSaida",
    header: "CST saída",
    show: "md",
    cell: (row) => (
      <CstCell compare atual={row.importado.cstUnico} ideal={row.correto?.cstSaida} />
    ),
  },
  {
    id: "cfop",
    header: "CFOP",
    show: "lg",
    className: "tabular",
    cell: (row) => row.correto?.cfopSaida ?? "—",
  },
  {
    id: "mva",
    header: "MVA",
    show: "lg",
    cell: (row) => (
      <CstCell compare atual={row.importado.ivaMva} ideal={row.correto?.mva} />
    ),
  },
  ...DESTINO_KEYS.map(
    (key): FiscalColumn<ProductSheetItem> => ({
      id: key,
      header: DESTINO_SHORT_LABELS[key],
      show: "xl",
      cell: (row) => (
        <CstCell
          compare
          atual={row.importado.destinosCst?.[key] ?? null}
          ideal={row.correto?.destinosCst[key] ?? null}
        />
      ),
    }),
  ),
];

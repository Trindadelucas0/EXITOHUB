import { CstCell } from "@/src/components/grid/cst-cell";
import type { FiscalColumn } from "@/src/components/grid/fiscal-grid";
import type { DestinosCst } from "@/src/lib/fiscal";
import { DESTINO_KEYS, DESTINO_SHORT_LABELS } from "@/src/lib/fiscal";

export type RuleSheetItem = {
  id: string;
  ncm: string;
  ncmOriginal: string;
  segmento: string;
  cstEntrada: string | null;
  cstSaida: string | null;
  cfopSaida: string | null;
  destinosCst: DestinosCst;
  situacao: string;
  situacaoCodigo: string;
  mvaTexto: string | null;
};

export const RULE_SHEET_COLUMNS: FiscalColumn<RuleSheetItem>[] = [
  {
    id: "ncm",
    header: "NCM",
    sticky: 1,
    className: "min-w-[6.75rem] font-medium tabular",
    cell: (row) => row.ncm,
  },
  {
    id: "segmento",
    header: "Segmento",
    sticky: 2,
    className: "min-w-[10rem] max-w-[14rem] truncate sm:min-w-[14rem]",
    cell: (row) => <span title={row.segmento}>{row.segmento}</span>,
  },
  {
    id: "situacao",
    header: "Situação",
    cell: (row) => row.situacaoCodigo || row.situacao,
  },
  {
    id: "cstEntrada",
    header: "CST entrada",
    show: "md",
    cell: (row) => <CstCell atual={row.cstEntrada} />,
  },
  {
    id: "cstSaida",
    header: "CST BAIFER",
    show: "md",
    cell: (row) => <CstCell atual={row.cstSaida} />,
  },
  {
    id: "cfop",
    header: "CFOP",
    show: "lg",
    className: "tabular",
    cell: (row) => row.cfopSaida ?? "—",
  },
  ...DESTINO_KEYS.map(
    (key): FiscalColumn<RuleSheetItem> => ({
      id: key,
      header: DESTINO_SHORT_LABELS[key],
      show: "xl",
      cell: (row) => <CstCell atual={row.destinosCst[key]} />,
    }),
  ),
  {
    id: "mva",
    header: "MVA",
    show: "lg",
    cell: (row) => row.mvaTexto ?? "—",
  },
];

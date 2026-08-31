import { CstCell } from "@/src/components/grid/cst-cell";
import type { FiscalColumn } from "@/src/components/grid/fiscal-grid";
import type { DestinosCst, UfTributacao } from "@/src/lib/fiscal";
import { DESTINO_KEYS, DESTINO_SHORT_LABELS, hasUfTributacao } from "@/src/lib/fiscal";

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
  cest?: string | null;
  ipi?: string | null;
  abreviacao?: string | null;
  reducao?: boolean;
  reducaoPercentual?: number | null;
  ufTributacao?: UfTributacao | null;
};

export function ruleUsesUnicaLayout(rules: RuleSheetItem[]): boolean {
  return rules.some((row) => hasUfTributacao(row.ufTributacao) || row.situacaoCodigo === "TRIBUTACAO_UF");
}

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

export const UNICA_SHEET_COLUMNS: FiscalColumn<RuleSheetItem>[] = [
  {
    id: "ncm",
    header: "NCM",
    sticky: 1,
    className: "min-w-[6.75rem] font-medium tabular",
    cell: (row) => row.ncm,
  },
  {
    id: "abreviacao",
    header: "Abrev.",
    show: "md",
    cell: (row) => row.abreviacao ?? "—",
  },
  {
    id: "cest",
    header: "CEST",
    className: "tabular",
    cell: (row) => row.cest ?? "—",
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
    id: "aliqDf",
    header: "Aliq. DF",
    show: "md",
    cell: (row) => row.ufTributacao?.DF.aliqInterna ?? "—",
  },
  {
    id: "mvaDf",
    header: "MVA DF",
    show: "md",
    cell: (row) => row.ufTributacao?.DF.original ?? row.mvaTexto ?? "—",
  },
  {
    id: "aliqGo",
    header: "Aliq. GO",
    show: "lg",
    cell: (row) => row.ufTributacao?.GO.aliqInterna ?? "—",
  },
  {
    id: "mvaGo",
    header: "MVA GO",
    show: "lg",
    cell: (row) => row.ufTributacao?.GO.original ?? "—",
  },
  {
    id: "aliqMg",
    header: "Aliq. MG",
    show: "lg",
    cell: (row) => row.ufTributacao?.MG.aliqInterna ?? "—",
  },
  {
    id: "mvaMg",
    header: "MVA MG",
    show: "lg",
    cell: (row) => row.ufTributacao?.MG.original ?? "—",
  },
];

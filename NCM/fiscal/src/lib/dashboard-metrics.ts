export const DASHBOARD_RANK_LIMIT = 8;

export type DashboardTotals = {
  total: number;
  corretos: number;
  divergentes: number;
  analise: number;
};

export type DashboardNcmRow = {
  ncm: string;
  total: number;
  corretos: number;
  divergentes: number;
  analise: number;
};

export type DashboardSegmentoRow = {
  id: string;
  label: string;
  total: number;
  corretos: number;
  divergentes: number;
  analise: number;
};

type GroupByStatusRow = {
  ncm: string;
  auditStatus: string | null;
  count: number;
};

export function emptyDashboardBreakdown(ruleCount = 0): {
  totals: DashboardTotals;
  ruleCount: number;
  treatedCount: number;
  untreatedAttention: number;
  topNcm: DashboardNcmRow[];
  segmento: { groups: DashboardSegmentoRow[] } | null;
  hasCadastro: boolean;
  batch: null;
} {
  return {
    totals: { total: 0, corretos: 0, divergentes: 0, analise: 0 },
    ruleCount,
    treatedCount: 0,
    untreatedAttention: 0,
    topNcm: [],
    segmento: null,
    hasCadastro: false,
    batch: null,
  };
}

export function foldNcmStatusCounts(rows: GroupByStatusRow[]): DashboardNcmRow[] {
  const byNcm = new Map<string, DashboardNcmRow>();
  for (const row of rows) {
    const current = byNcm.get(row.ncm) ?? {
      ncm: row.ncm,
      total: 0,
      corretos: 0,
      divergentes: 0,
      analise: 0,
    };
    current.total += row.count;
    if (row.auditStatus === "CORRETO") current.corretos += row.count;
    if (row.auditStatus === "DIVERGENTE") current.divergentes += row.count;
    if (row.auditStatus === "NECESSITA_ANALISE") current.analise += row.count;
    byNcm.set(row.ncm, current);
  }
  return [...byNcm.values()];
}

export function rankAttentionNcm(groups: DashboardNcmRow[], limit = DASHBOARD_RANK_LIMIT): DashboardNcmRow[] {
  return groups
    .filter((row) => row.divergentes + row.analise > 0)
    .sort(
      (a, b) =>
        b.divergentes + b.analise - (a.divergentes + a.analise) || a.ncm.localeCompare(b.ncm),
    )
    .slice(0, limit);
}

export function statusPercents(totals: DashboardTotals): {
  analisados: number;
  corretos: number;
  divergentes: number;
  analise: number;
} {
  if (totals.total <= 0) {
    return { analisados: 0, corretos: 0, divergentes: 0, analise: 0 };
  }
  const corretos = Math.round((100 * totals.corretos) / totals.total);
  const divergentes = Math.round((100 * totals.divergentes) / totals.total);
  const analise = Math.max(0, 100 - corretos - divergentes);
  return { analisados: 100, corretos, divergentes, analise };
}

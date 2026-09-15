import "server-only";

import { listSegmentoSummary } from "@/src/server/audit";
import type { ImportBatchSummary } from "@/src/server/batch";
import { withTenant } from "@/src/server/db";
import {
  DASHBOARD_RANK_LIMIT,
  emptyDashboardBreakdown,
  foldNcmStatusCounts,
  rankAttentionNcm,
} from "@/src/lib/dashboard-metrics";
import { dashboardTotalsFromBatch } from "@/src/server/product-query";

export { DASHBOARD_RANK_LIMIT, emptyDashboardBreakdown, foldNcmStatusCounts, rankAttentionNcm };

export type DashboardBreakdown = Omit<ReturnType<typeof emptyDashboardBreakdown>, "batch"> & {
  batch: ImportBatchSummary | null;
};

export async function loadDashboardBreakdown(
  companyId: string,
  batch: ImportBatchSummary | null,
): Promise<DashboardBreakdown> {
  if (!batch) {
    const ruleCount = await withTenant(companyId, (db) =>
      db.fiscalNcmRule.count({ where: { companyId } }),
    );
    return emptyDashboardBreakdown(ruleCount);
  }

  const counted = await withTenant(companyId, async (db) => {
    const loteWhere = { companyId, importBatchId: batch.id };
    const [ruleCount, treatedCount, untreatedAttention, grouped] = await Promise.all([
      db.fiscalNcmRule.count({ where: { companyId } }),
      db.product.count({ where: { ...loteWhere, treatedAt: { not: null } } }),
      db.product.count({
        where: {
          ...loteWhere,
          treatedAt: null,
          auditStatus: { in: ["DIVERGENTE", "NECESSITA_ANALISE"] },
        },
      }),
      db.product.groupBy({
        by: ["ncm", "auditStatus"],
        where: { ...loteWhere, auditStatus: { not: null } },
        _count: { _all: true },
      }),
    ]);
    return {
      ruleCount,
      treatedCount,
      untreatedAttention,
      grouped,
    };
  });

  const topNcm = rankAttentionNcm(
    foldNcmStatusCounts(
      counted.grouped.map((row) => ({
        ncm: row.ncm,
        auditStatus: row.auditStatus,
        count: row._count._all,
      })),
    ),
  );

  const listed = await listSegmentoSummary(
    companyId,
    batch.id,
    new URL("http://dashboard.local/api/dashboard"),
  );
  const segmento = listed.unica
    ? {
        groups: listed.groups.slice(0, DASHBOARD_RANK_LIMIT).map((group) => ({
          id: group.id,
          label: group.label,
          total: group.total,
          corretos: group.corretos,
          divergentes: group.divergentes,
          analise: group.analise,
        })),
      }
    : null;

  return {
    totals: dashboardTotalsFromBatch(batch),
    ruleCount: counted.ruleCount,
    treatedCount: counted.treatedCount,
    untreatedAttention: counted.untreatedAttention,
    topNcm,
    segmento,
    hasCadastro: true,
    batch,
  };
}

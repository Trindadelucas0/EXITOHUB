import { activeBatchForRequest } from "@/src/server/batch";
import { withTenant } from "@/src/server/db";
import { jsonError, jsonOk } from "@/src/server/http";
import { dashboardTotalsFromBatch } from "@/src/server/product-query";
import { requireCompanySession } from "@/src/server/tenant";

export async function GET(request: Request) {
  try {
    const user = await requireCompanySession();
    const batch = await activeBatchForRequest(user.companyId, request);
    const ruleCount = await withTenant(user.companyId, (db) =>
      db.fiscalNcmRule.count({ where: { companyId: user.companyId } }),
    );
    return jsonOk({
      totals: dashboardTotalsFromBatch(batch),
      ruleCount,
      hasCadastro: Boolean(batch),
      batch,
    });
  } catch (error) {
    return jsonError(error);
  }
}

import { activeBatchForRequest } from "@/src/server/batch";
import { loadDashboardBreakdown } from "@/src/server/dashboard-breakdown";
import { jsonError, jsonOk } from "@/src/server/http";
import { requireCompanySession } from "@/src/server/tenant";

export async function GET(request: Request) {
  try {
    const user = await requireCompanySession();
    const batch = await activeBatchForRequest(user.companyId, request);
    return jsonOk(await loadDashboardBreakdown(user.companyId, batch));
  } catch (error) {
    return jsonError(error);
  }
}

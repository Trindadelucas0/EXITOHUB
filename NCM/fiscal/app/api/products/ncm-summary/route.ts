import { listNcmSummary } from "@/src/server/audit";
import { activeBatchForRequest } from "@/src/server/batch";
import { jsonError, jsonOk } from "@/src/server/http";
import { requireCompanySession } from "@/src/server/tenant";

export async function GET(request: Request) {
  try {
    const user = await requireCompanySession();
    const batch = await activeBatchForRequest(user.companyId, request);
    if (!batch) {
      return jsonOk({ ncmCount: 0, productCount: 0, groups: [] });
    }
    const listed = await listNcmSummary(user.companyId, batch.id, new URL(request.url));
    return jsonOk(listed);
  } catch (error) {
    return jsonError(error);
  }
}

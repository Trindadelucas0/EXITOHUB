import { listAuditedProducts } from "@/src/server/audit";
import { activeBatchForRequest } from "@/src/server/batch";
import { jsonError, jsonOk } from "@/src/server/http";
import { requireCompanySession } from "@/src/server/tenant";

export async function GET(request: Request) {
  try {
    const user = await requireCompanySession();
    const batch = await activeBatchForRequest(user.companyId, request);
    if (!batch) {
      return jsonOk({
        items: [],
        summary: { total: 0, corretos: 0, divergentes: 0, analise: 0 },
        catalogTotal: 0,
        total: 0,
        page: 1,
        pageSize: 25,
        pageCount: 1,
        batch: null,
      });
    }
    const listed = await listAuditedProducts(user.companyId, batch.id, new URL(request.url));
    return jsonOk({
      ...listed,
      batch,
    });
  } catch (error) {
    return jsonError(error);
  }
}

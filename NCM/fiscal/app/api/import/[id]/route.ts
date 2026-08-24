import { BATCH_COOKIE, batchCookieOptions, listImportBatches, requireOwnedBatch } from "@/src/server/batch";
import { withTenant } from "@/src/server/db";
import { jsonError, jsonOk } from "@/src/server/http";
import { requireCompanyAdmin, requireCompanySession } from "@/src/server/tenant";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanySession();
    requireCompanyAdmin(user);
    const { id } = await context.params;
    await requireOwnedBatch(user.companyId, id);
    const ruleCountBefore = await withTenant(user.companyId, (db) =>
      db.fiscalNcmRule.count({ where: { companyId: user.companyId } }),
    );
    await withTenant(user.companyId, (db) =>
      db.importBatch.deleteMany({ where: { id, companyId: user.companyId } }),
    );
    const remaining = await listImportBatches(user.companyId);
    const nextId = remaining[0]?.id ?? "";
    const response = jsonOk({
      deleted: id,
      rulesStillThere: ruleCountBefore,
      activeBatchId: nextId || null,
    });
    if (nextId) {
      response.cookies.set(BATCH_COOKIE, nextId, batchCookieOptions());
    } else {
      response.cookies.set(BATCH_COOKIE, "", { ...batchCookieOptions(), maxAge: 0 });
    }
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanySession();
    const { id } = await context.params;
    const batch = await requireOwnedBatch(user.companyId, id);
    return jsonOk({
      batch: {
        id: batch.id,
        fileName: batch.fileName,
        totalRows: batch.totalRows,
        corretos: batch.corretos,
        divergentes: batch.divergentes,
        analise: batch.analise,
        createdAt: batch.createdAt,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

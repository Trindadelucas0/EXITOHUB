import { findPreviousBatch, requireOwnedBatch } from "@/src/server/batch";
import { diffBatchRows, filterDiffItems, type BatchDiffKind } from "@/src/server/batch-diff";
import { withTenant } from "@/src/server/db";
import { jsonError, jsonOk } from "@/src/server/http";
import { parseProductListParams } from "@/src/server/product-query";
import { requireCompanySession } from "@/src/server/tenant";

const KINDS = new Set<BatchDiffKind>([
  "added",
  "removed",
  "ncm_changed",
  "status_changed",
  "unchanged",
]);

export async function GET(request: Request) {
  try {
    const user = await requireCompanySession();
    const url = new URL(request.url);
    const lote = (url.searchParams.get("lote") ?? "").trim();
    if (!lote) {
      return jsonOk({
        previous: null,
        summary: { added: 0, removed: 0, ncmChanged: 0, statusChanged: 0, unchanged: 0 },
        items: [],
        total: 0,
        page: 1,
        pageSize: 25,
        pageCount: 1,
      });
    }
    await requireOwnedBatch(user.companyId, lote);
    const previous = await findPreviousBatch(user.companyId, lote);
    const params = parseProductListParams(url);
    const rawTipo = (url.searchParams.get("tipo") ?? "").trim();
    const tipo = KINDS.has(rawTipo as BatchDiffKind) ? (rawTipo as BatchDiffKind) : "";

    if (!previous) {
      return jsonOk({
        previous: null,
        summary: { added: 0, removed: 0, ncmChanged: 0, statusChanged: 0, unchanged: 0 },
        items: [],
        total: 0,
        page: params.page,
        pageSize: params.pageSize,
        pageCount: 1,
      });
    }

    const payload = await withTenant(user.companyId, async (db) => {
      const select = { codigo: true, ncm: true, auditStatus: true };
      const [currentRows, previousRows] = await Promise.all([
        db.product.findMany({
          where: { companyId: user.companyId, importBatchId: lote, auditStatus: { not: null } },
          select,
        }),
        db.product.findMany({
          where: { companyId: user.companyId, importBatchId: previous.id, auditStatus: { not: null } },
          select,
        }),
      ]);
      const diff = diffBatchRows(currentRows, previousRows);
      const filtered = filterDiffItems(diff.items, tipo);
      const start = (params.page - 1) * params.pageSize;
      return {
        previous: {
          id: previous.id,
          fileName: previous.fileName,
          createdAt: previous.createdAt,
        },
        summary: diff.summary,
        items: filtered.slice(start, start + params.pageSize),
        total: filtered.length,
        page: params.page,
        pageSize: params.pageSize,
        pageCount: Math.max(1, Math.ceil(filtered.length / params.pageSize)),
      };
    });
    return jsonOk(payload);
  } catch (error) {
    return jsonError(error);
  }
}

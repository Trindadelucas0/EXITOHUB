import "server-only";

import { cookies } from "next/headers";
import { BATCH_COOKIE } from "@/src/lib/constants";
import { withTenant } from "./db";
import { HttpError } from "./tenant";

export { productsOfBatch } from "@/src/lib/batch-scope";

export { BATCH_COOKIE };

export type ImportBatchSummary = {
  id: string;
  fileName: string;
  totalRows: number;
  corretos: number;
  divergentes: number;
  analise: number;
  createdAt: Date;
};

export function batchCookieOptions() {
  const secure =
    process.env.COOKIE_SECURE === "1" ||
    (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "0");
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 8 * 60 * 60,
  };
}

export async function readBatchCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(BATCH_COOKIE)?.value;
}

export async function listImportBatches(companyId: string): Promise<ImportBatchSummary[]> {
  return withTenant(companyId, (db) =>
    db.importBatch.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        totalRows: true,
        corretos: true,
        divergentes: true,
        analise: true,
        createdAt: true,
      },
    }),
  );
}

export async function findOwnedBatch(companyId: string, batchId: string) {
  const batch = await withTenant(companyId, (db) =>
    db.importBatch.findFirst({
      where: { id: batchId, companyId },
    }),
  );
  return batch;
}

export async function requireOwnedBatch(companyId: string, batchId: string) {
  const batch = await findOwnedBatch(companyId, batchId);
  if (!batch) {
    throw new HttpError(404, "NOT_FOUND", "Lote não encontrado.");
  }
  return batch;
}

export async function resolveActiveBatch(
  companyId: string,
  requestedId: string | undefined,
  strictQuery: boolean,
): Promise<ImportBatchSummary | null> {
  if (requestedId && strictQuery) {
    const batch = await findOwnedBatch(companyId, requestedId);
    if (!batch) {
      throw new HttpError(404, "NOT_FOUND", "Lote não encontrado.");
    }
    return {
      id: batch.id,
      fileName: batch.fileName,
      totalRows: batch.totalRows,
      corretos: batch.corretos,
      divergentes: batch.divergentes,
      analise: batch.analise,
      createdAt: batch.createdAt,
    };
  }

  if (requestedId) {
    const cookieBatch = await findOwnedBatch(companyId, requestedId);
    if (cookieBatch) {
      return {
        id: cookieBatch.id,
        fileName: cookieBatch.fileName,
        totalRows: cookieBatch.totalRows,
        corretos: cookieBatch.corretos,
        divergentes: cookieBatch.divergentes,
        analise: cookieBatch.analise,
        createdAt: cookieBatch.createdAt,
      };
    }
  }

  const latest = await withTenant(companyId, (db) =>
    db.importBatch.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    }),
  );
  if (!latest) return null;
  return {
    id: latest.id,
    fileName: latest.fileName,
    totalRows: latest.totalRows,
    corretos: latest.corretos,
    divergentes: latest.divergentes,
    analise: latest.analise,
    createdAt: latest.createdAt,
  };
}

export async function findPreviousBatch(companyId: string, currentBatchId: string) {
  const current = await requireOwnedBatch(companyId, currentBatchId);
  return withTenant(companyId, (db) =>
    db.importBatch.findFirst({
      where: {
        companyId,
        createdAt: { lt: current.createdAt },
        NOT: { id: current.id },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function activeBatchForRequest(companyId: string, request: Request) {
  const url = new URL(request.url);
  const queryLote = (url.searchParams.get("lote") ?? url.searchParams.get("batchId") ?? "").trim();
  if (queryLote) return resolveActiveBatch(companyId, queryLote, true);
  const cookieLote = await readBatchCookie();
  return resolveActiveBatch(companyId, cookieLote, false);
}

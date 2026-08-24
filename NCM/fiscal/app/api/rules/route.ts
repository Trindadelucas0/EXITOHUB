import { Prisma } from "@prisma/client";
import { persistBatchSummary } from "@/src/server/audit";
import { LONG_TX, withTenant } from "@/src/server/db";
import { jsonError, jsonOk } from "@/src/server/http";
import { HttpError, requireCompanyAdmin, requireCompanySession } from "@/src/server/tenant";
import { ruleBodySchema, ruleWriteData } from "@/src/server/rule-write";

export async function GET(request: Request) {
  try {
    const user = await requireCompanySession();
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const situacao = (url.searchParams.get("situacao") ?? "").trim();
    const rules = await withTenant(user.companyId, (db) =>
      db.fiscalNcmRule.findMany({
        where: {
          companyId: user.companyId,
          ...(situacao ? { situacaoCodigo: situacao } : {}),
          ...(q
            ? {
                OR: [
                  { ncm: { contains: q } },
                  { ncmOriginal: { contains: q } },
                  { segmento: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ ncm: "asc" }, { situacaoCodigo: "asc" }],
        take: 2000,
      }),
    );
    return jsonOk({ rules });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCompanySession();
    requireCompanyAdmin(user);
    const body = ruleBodySchema.parse(await request.json());
    const data = ruleWriteData(user.companyId, body);
    const rule = await withTenant(user.companyId, (db) => db.fiscalNcmRule.create({ data }));
    return jsonOk({ rule }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(new HttpError(409, "CONFLICT", "Já existe regra com este NCM e situação."));
    }
    return jsonError(error);
  }
}

/** Apaga todas as regras NCM da empresa ativa (importação da base fiscal). */
export async function DELETE() {
  try {
    const user = await requireCompanySession();
    requireCompanyAdmin(user);
    const cleared = await withTenant(
      user.companyId,
      async (db) => {
        await db.productRuleLink.deleteMany({ where: { companyId: user.companyId } });
        const deleted = await db.fiscalNcmRule.deleteMany({ where: { companyId: user.companyId } });
        const batches = await db.importBatch.findMany({
          where: { companyId: user.companyId },
          select: { id: true },
          orderBy: { createdAt: "desc" },
        });
        return { deletedRules: deleted.count, batchIds: batches.map((batch) => batch.id) };
      },
      LONG_TX,
    );
    for (const batchId of cleared.batchIds) {
      await persistBatchSummary(user.companyId, batchId);
    }
    return jsonOk({
      deleted: cleared.deletedRules,
      batchesResynced: cleared.batchIds.length,
    });
  } catch (error) {
    return jsonError(error);
  }
}

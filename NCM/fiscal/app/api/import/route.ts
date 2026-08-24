import { NextResponse } from "next/server";
import { resolveDisplayedBatchId } from "@/src/lib/batch-scope";
import { ruleFromDb } from "@/src/server/audit";
import {
  BATCH_COOKIE,
  batchCookieOptions,
  listImportBatches,
  readBatchCookie,
} from "@/src/server/batch";
import { LONG_TX, withTenant } from "@/src/server/db";
import { jsonError, jsonOk } from "@/src/server/http";
import {
  assertSafeUpload,
  parseCadastroBuffer,
  sanitizeFileName,
} from "@/src/server/import-cadastro";
import { indexRulesByNcm, scoreParsedProducts } from "@/src/server/import-score";
import { carryTreatedMarker, indexPreviousMarkers } from "@/src/server/treated-carry";
import { requireCompanyAdmin, requireCompanySession } from "@/src/server/tenant";

export async function POST(request: Request) {
  try {
    const user = await requireCompanySession();
    requireCompanyAdmin(user);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION", message: "Envie um arquivo." } },
        { status: 400 },
      );
    }
    const ext = assertSafeUpload(file.name, file.size, file.type);
    const buffer = Buffer.from(await file.arrayBuffer());
    const products = parseCadastroBuffer(buffer, ext);
    if (products.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "EMPTY", message: "Nenhuma linha de cadastro reconhecida." },
        },
        { status: 400 },
      );
    }
    const keepTreated = String(form.get("manterTratados") ?? "1") !== "0";

    const result = await withTenant(
      user.companyId,
      async (db) => {
        const previous = await db.importBatch.findFirst({
          where: { companyId: user.companyId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        const ruleRows = await db.fiscalNcmRule.findMany({ where: { companyId: user.companyId } });
        const { scored, totals } = scoreParsedProducts(
          products,
          indexRulesByNcm(ruleRows.map(ruleFromDb)),
        );
        const previousMarkers = keepTreated && previous
          ? await db.product.findMany({
              where: {
                companyId: user.companyId,
                importBatchId: previous.id,
                treatedAt: { not: null },
              },
              select: {
                codigo: true,
                auditStatus: true,
                treatedAt: true,
                treatedByUserId: true,
                treatedNote: true,
              },
            })
          : [];
        const previousByCodigo = indexPreviousMarkers(previousMarkers);

        const batch = await db.importBatch.create({
          data: {
            companyId: user.companyId,
            userId: user.id,
            fileName: sanitizeFileName(file.name),
            totalRows: totals.total,
            corretos: totals.corretos,
            divergentes: totals.divergentes,
            analise: totals.analise,
          },
        });
        const chunkSize = 200;
        for (let i = 0; i < scored.length; i += chunkSize) {
          const slice = scored.slice(i, i + chunkSize);
          await db.product.createMany({
            data: slice.map((item) => {
              const carried = carryTreatedMarker(
                keepTreated,
                item.codigo,
                item.auditStatus,
                previousByCodigo,
              );
              return {
                companyId: user.companyId,
                importBatchId: batch.id,
                codigo: item.codigo,
                descricao: item.descricao,
                ncm: item.ncm,
                ncmOriginal: item.ncmOriginal,
                aliquotaIcms: item.aliquotaIcms,
                ivaMva: item.ivaMva,
                ivaMvaNumero: item.ivaMvaNumero,
                cest: item.cest,
                cstCompra: item.cstCompra,
                cstUnico: item.cstUnico,
                destinosCst: item.destinosCst ?? undefined,
                auditStatus: item.auditStatus,
                auditMotivo: item.auditMotivo,
                treatedAt: carried.treatedAt,
                treatedByUserId: carried.treatedByUserId,
                treatedNote: carried.treatedNote,
                treatedStale: carried.treatedStale,
              };
            }),
          });
        }
        const rulesStillThere = await db.fiscalNcmRule.count({
          where: { companyId: user.companyId },
        });
        return {
          batchId: batch.id,
          imported: products.length,
          totals,
          rulesStillThere,
          keepTreated: keepTreated && Boolean(previous),
        };
      },
      LONG_TX,
    );

    const response = jsonOk(result);
    response.cookies.set(BATCH_COOKIE, result.batchId, batchCookieOptions());
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET() {
  try {
    const user = await requireCompanySession();
    const batches = await listImportBatches(user.companyId);
    const cookieLote = await readBatchCookie();
    const activeBatchId = resolveDisplayedBatchId(batches, null, cookieLote) || null;
    return jsonOk({
      batches,
      activeBatchId,
    });
  } catch (error) {
    return jsonError(error);
  }
}

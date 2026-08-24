import "server-only";

import { Prisma } from "@prisma/client";
import { productFromDb, ruleFromDb } from "./audit-map";
import { compareProduct, type FiscalRule } from "./compare";
import { LONG_TX, withTenant } from "./db";
import { auditCounterDeltas } from "./product-query";
import { applyRuleValuesToProduct, resolveLinkedRule } from "./treated-apply";
import { HttpError } from "./tenant";

const productSelect = {
  id: true,
  codigo: true,
  descricao: true,
  ncm: true,
  ncmOriginal: true,
  aliquotaIcms: true,
  ivaMva: true,
  ivaMvaNumero: true,
  cest: true,
  cstCompra: true,
  cstUnico: true,
  destinosCst: true,
  auditStatus: true,
  importBatchId: true,
} satisfies Prisma.ProductSelect;

type MarkScope = { productId: string } | { batchId: string; ncm: string };

export async function markProductsTreated(params: {
  companyId: string;
  userId: string;
  treated: boolean;
  note?: string | null;
  scope: MarkScope;
}) {
  return withTenant(
    params.companyId,
    async (db) => {
      const rows = await loadScope(db, params.companyId, params.scope);
      if ("productId" in params.scope && rows.length === 0) {
        throw new HttpError(404, "NOT_FOUND", "Produto não encontrado.");
      }
      if (rows.length === 0) {
        return { updated: 0, treated: params.treated };
      }
      const ncms = [...new Set(rows.map((row) => row.ncm))];
      const [ruleRows, links] = await Promise.all([
        db.fiscalNcmRule.findMany({
          where: { companyId: params.companyId, ncm: { in: ncms } },
        }),
        db.productRuleLink.findMany({
          where: {
            companyId: params.companyId,
            productId: { in: rows.map((row) => row.id) },
          },
          select: { productId: true, ruleId: true },
        }),
      ]);
      const rulesByNcm = new Map<string, FiscalRule[]>();
      for (const row of ruleRows) {
        const mapped = ruleFromDb(row);
        const list = rulesByNcm.get(mapped.ncm) ?? [];
        list.push(mapped);
        rulesByNcm.set(mapped.ncm, list);
      }
      const linkByProduct = new Map(links.map((link) => [link.productId, link.ruleId]));
      const treatedAt = params.treated ? new Date() : null;
      const batchDeltas = new Map<
        string,
        { corretos: number; divergentes: number; analise: number }
      >();

      for (const row of rows) {
        const mapped = productFromDb(row);
        const rules = rulesByNcm.get(mapped.ncm) ?? [];
        const linkedRuleId = linkByProduct.get(row.id) ?? null;
        const rule = resolveLinkedRule(rules, linkedRuleId);
        const nextProduct =
          params.treated && rule ? applyRuleValuesToProduct(mapped, rule) : mapped;
        const compare = compareProduct(nextProduct, rules, linkedRuleId);
        const valuePatch =
          params.treated && rule
            ? {
                cstCompra: nextProduct.cstCompra,
                cstUnico: nextProduct.cstUnico,
                destinosCst: nextProduct.destinosCst as Prisma.InputJsonValue,
                ivaMva: nextProduct.ivaMva ?? null,
                ivaMvaNumero: nextProduct.ivaMvaNumero,
              }
            : {};
        await db.product.updateMany({
          where: { id: row.id, companyId: params.companyId },
          data: {
            ...valuePatch,
            auditStatus: compare.status,
            auditMotivo: compare.motivo,
            treatedAt,
            treatedByUserId: params.treated ? params.userId : null,
            treatedNote: params.treated ? params.note || null : null,
            treatedStale: false,
          },
        });
        const delta = auditCounterDeltas(row.auditStatus, compare.status);
        const current = batchDeltas.get(row.importBatchId) ?? {
          corretos: 0,
          divergentes: 0,
          analise: 0,
        };
        current.corretos += delta.corretos;
        current.divergentes += delta.divergentes;
        current.analise += delta.analise;
        batchDeltas.set(row.importBatchId, current);
      }

      for (const [batchId, deltas] of batchDeltas) {
        if (!deltas.corretos && !deltas.divergentes && !deltas.analise) continue;
        await db.importBatch.updateMany({
          where: { id: batchId, companyId: params.companyId },
          data: {
            corretos: { increment: deltas.corretos },
            divergentes: { increment: deltas.divergentes },
            analise: { increment: deltas.analise },
          },
        });
      }

      return { updated: rows.length, treated: params.treated };
    },
    LONG_TX,
  );
}

async function loadScope(
  db: import("@prisma/client").PrismaClient,
  companyId: string,
  scope: MarkScope,
) {
  if ("productId" in scope) {
    return db.product.findMany({
      where: { id: scope.productId, companyId },
      select: productSelect,
    });
  }
  const batch = await db.importBatch.findFirst({
    where: { id: scope.batchId, companyId },
    select: { id: true },
  });
  if (!batch) throw new HttpError(404, "NOT_FOUND", "Lote não encontrado.");
  return db.product.findMany({
    where: {
      companyId,
      importBatchId: batch.id,
      ncm: { contains: scope.ncm },
      auditStatus: { not: null },
    },
    select: productSelect,
  });
}

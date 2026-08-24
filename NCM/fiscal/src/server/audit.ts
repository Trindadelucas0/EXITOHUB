import "server-only";

import { Prisma } from "@prisma/client";
import {
  compareProduct,
  summarizeStatus,
  type CompareResult,
  type FiscalRule,
  type ImportedProduct,
} from "./compare";
import { productFromDb, ruleFromDb } from "./audit-map";
import { LONG_TX, withTenant } from "./db";
import { isJunkRow } from "./import-cadastro";
import { parseProductListParams, auditCounterDeltas, digitsOnly, treatedWhere } from "./product-query";
import type { StatusFiscal } from "@/src/lib/fiscal";
import { HttpError } from "./tenant";

export { productFromDb, ruleFromDb };

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
  auditMotivo: true,
  importBatchId: true,
  treatedAt: true,
  treatedByUserId: true,
  treatedNote: true,
  treatedStale: true,
} satisfies Prisma.ProductSelect;

export function sheetItemFromCompare(
  product: ImportedProduct & { id: string },
  compare: CompareResult,
  includeDiffs: boolean,
  treated?: { treated: boolean; treatedStale: boolean; treatedNote: string | null },
) {
  return {
    id: product.id,
    codigo: product.codigo,
    descricao: product.descricao,
    ncm: product.ncm,
    ncmOriginal: product.ncmOriginal,
    status: compare.status,
    motivo: compare.motivo,
    needsLink: compare.needsLink,
    situacao: compare.rule?.situacao ?? compare.rule?.situacaoCodigo ?? null,
    situacaoCodigo: compare.rule?.situacaoCodigo ?? null,
    diffs: includeDiffs ? compare.diffs : [],
    treated: treated?.treated ?? false,
    treatedStale: treated?.treatedStale ?? false,
    treatedNote: treated?.treatedNote ?? null,
    importado: {
      cstCompra: product.cstCompra ?? null,
      cstUnico: product.cstUnico ?? null,
      ivaMva: product.ivaMva ?? null,
      destinosCst: product.destinosCst,
    },
    correto: compare.rule
      ? {
          ncm: compare.rule.ncm,
          cstEntrada: compare.rule.cstEntrada,
          cstSaida: compare.rule.cstSaida,
          cfopSaida: compare.rule.cfopSaida,
          destinosCst: compare.rule.destinosCst,
          mva:
            compare.rule.mvaPercentual != null
              ? String(compare.rule.mvaPercentual)
              : compare.rule.mvaTexto,
          situacao: compare.rule.situacao || compare.rule.situacaoCodigo,
        }
      : null,
    candidates: includeDiffs
      ? compare.candidates.map((candidate) => ({
          id: candidate.id,
          situacao: candidate.situacao,
          situacaoCodigo: candidate.situacaoCodigo,
          cstSaida: candidate.cstSaida,
          cfopSaida: candidate.cfopSaida,
        }))
      : [],
  };
}

function asStatus(value: string | null | undefined): StatusFiscal {
  if (value === "CORRETO" || value === "DIVERGENTE" || value === "NECESSITA_ANALISE") return value;
  return "NECESSITA_ANALISE";
}

export function sheetItemFromPersisted(
  product: ImportedProduct & {
    id: string;
    auditStatus: string | null;
    auditMotivo: string | null;
    treatedAt: Date | null;
    treatedStale: boolean;
    treatedNote: string | null;
  },
  rulesForNcm: FiscalRule[],
  linkedRuleId: string | null,
) {
  const rule =
    rulesForNcm.find((item) => item.id === linkedRuleId) ??
    (rulesForNcm.length === 1 ? rulesForNcm[0] : null);
  return {
    id: product.id,
    codigo: product.codigo,
    descricao: product.descricao,
    ncm: product.ncm,
    ncmOriginal: product.ncmOriginal,
    status: asStatus(product.auditStatus),
    motivo: product.auditMotivo ?? "",
    needsLink: rulesForNcm.length > 1 && !linkedRuleId,
    situacao: rule?.situacao ?? rule?.situacaoCodigo ?? null,
    situacaoCodigo: rule?.situacaoCodigo ?? null,
    diffs: [] as CompareResult["diffs"],
    treated: Boolean(product.treatedAt),
    treatedStale: product.treatedStale,
    treatedNote: product.treatedNote,
    importado: {
      cstCompra: product.cstCompra ?? null,
      cstUnico: product.cstUnico ?? null,
      ivaMva: product.ivaMva ?? null,
      destinosCst: product.destinosCst,
    },
    correto: rule
      ? {
          ncm: rule.ncm,
          cstEntrada: rule.cstEntrada,
          cstSaida: rule.cstSaida,
          cfopSaida: rule.cfopSaida,
          destinosCst: rule.destinosCst,
          mva: rule.mvaPercentual != null ? String(rule.mvaPercentual) : rule.mvaTexto,
          situacao: rule.situacao || rule.situacaoCodigo,
        }
      : null,
    candidates: [],
  };
}

async function loadRulesAndLinks(
  db: import("@prisma/client").PrismaClient,
  companyId: string,
  ncmFilter?: string[],
  productIds?: string[],
) {
  const [rules, links] = await Promise.all([
    db.fiscalNcmRule.findMany({
      where: {
        companyId,
        ...(ncmFilter && ncmFilter.length > 0 ? { ncm: { in: ncmFilter } } : {}),
      },
    }),
    db.productRuleLink.findMany({
      where: {
        companyId,
        ...(productIds && productIds.length > 0 ? { productId: { in: productIds } } : {}),
      },
      select: { productId: true, ruleId: true },
    }),
  ]);
  return { rules, links };
}

function indexRules(rules: Parameters<typeof ruleFromDb>[0][]) {
  const rulesByNcm = new Map<string, FiscalRule[]>();
  for (const rule of rules) {
    const mapped = ruleFromDb(rule);
    const list = rulesByNcm.get(mapped.ncm) ?? [];
    list.push(mapped);
    rulesByNcm.set(mapped.ncm, list);
  }
  return rulesByNcm;
}

export async function compareCompanyProducts(
  companyId: string,
  batchId: string,
  options?: { statuses?: StatusFiscal[]; tratado?: "" | "nao" | "sim" },
): Promise<{ product: ImportedProduct & { id: string }; compare: CompareResult }[]> {
  return withTenant(
    companyId,
    async (db) => {
      const batch = await db.importBatch.findFirst({
        where: { id: batchId, companyId },
        select: { id: true },
      });
      if (!batch) {
        throw new HttpError(404, "NOT_FOUND", "Lote não encontrado.");
      }
      const products = await db.product.findMany({
        where: {
          companyId,
          importBatchId: batchId,
          ...(options?.statuses?.length
            ? { auditStatus: { in: options.statuses } }
            : {}),
          ...treatedWhere(options?.tratado ?? ""),
        },
        orderBy: { codigo: "asc" },
        select: productSelect,
      });
      const ncms = [...new Set(products.map((row) => row.ncm))];
      const { rules, links } = await loadRulesAndLinks(
        db,
        companyId,
        ncms,
        products.map((row) => row.id),
      );
      const rulesByNcm = indexRules(rules);
      const linkByProduct = new Map(links.map((l) => [l.productId, l.ruleId]));
      return products
        .filter((row) => !isJunkRow(row.codigo, row.descricao))
        .map((row) => {
          const product = { ...productFromDb(row), id: row.id };
          const compare = compareProduct(
            product,
            rulesByNcm.get(product.ncm) ?? [],
            linkByProduct.get(row.id) ?? null,
          );
          return { product, compare };
        });
    },
    LONG_TX,
  );
}

export async function persistBatchSummary(companyId: string, batchId: string) {
  const items = await compareCompanyProducts(companyId, batchId);
  const usable = items.filter((item) => !isJunkRow(item.product.codigo, item.product.descricao));
  const totals = summarizeStatus(usable.map((item) => item.compare));
  const chunkSize = 200;
  for (let i = 0; i < usable.length; i += chunkSize) {
    const slice = usable.slice(i, i + chunkSize);
    await withTenant(
      companyId,
      async (db) => {
        for (const item of slice) {
          await db.product.updateMany({
            where: { id: item.product.id, companyId, importBatchId: batchId },
            data: {
              auditStatus: item.compare.status,
              auditMotivo: item.compare.motivo,
            },
          });
        }
      },
      LONG_TX,
    );
  }
  await withTenant(
    companyId,
    (db) =>
      db.importBatch.updateMany({
        where: { id: batchId, companyId },
        data: {
          totalRows: usable.length,
          corretos: totals.corretos,
          divergentes: totals.divergentes,
          analise: totals.analise,
        },
      }),
    LONG_TX,
  );
  return totals;
}

export async function syncProductAudit(companyId: string, productId: string) {
  return withTenant(
    companyId,
    async (db) => {
      const productRow = await db.product.findFirst({
        where: { id: productId, companyId },
        select: productSelect,
      });
      if (!productRow) {
        throw new HttpError(404, "NOT_FOUND", "Produto não encontrado.");
      }
      if (isJunkRow(productRow.codigo, productRow.descricao)) {
        return null;
      }
      const { rules, links } = await loadRulesAndLinks(db, companyId, [productRow.ncm], [productRow.id]);
      const compare = compareProduct(
        productFromDb(productRow),
        indexRules(rules).get(productRow.ncm) ?? [],
        links[0]?.ruleId ?? null,
      );
      const previous = productRow.auditStatus;
      await db.product.updateMany({
        where: { id: productId, companyId },
        data: {
          auditStatus: compare.status,
          auditMotivo: compare.motivo,
        },
      });
      const deltas = auditCounterDeltas(previous, compare.status);
      if (deltas.corretos || deltas.divergentes || deltas.analise) {
        await db.importBatch.updateMany({
          where: { id: productRow.importBatchId, companyId },
          data: {
            corretos: { increment: deltas.corretos },
            divergentes: { increment: deltas.divergentes },
            analise: { increment: deltas.analise },
          },
        });
      }
      return compare;
    },
    LONG_TX,
  );
}

function searchWhere(
  companyId: string,
  batchId: string,
  q: string,
  ncmFilter: string,
  tratado: ReturnType<typeof parseProductListParams>["tratado"],
): Prisma.ProductWhereInput {
  const qLower = q.toLowerCase();
  const ncmDigits = digitsOnly(q);
  return {
    companyId,
    importBatchId: batchId,
    auditStatus: { not: null },
    ...treatedWhere(tratado),
    ...(ncmFilter ? { ncm: { contains: ncmFilter } } : {}),
    ...(q
      ? {
          OR: [
            { codigo: { contains: q, mode: "insensitive" } },
            { descricao: { contains: q, mode: "insensitive" } },
            { ncm: { contains: qLower } },
            { ncmOriginal: { contains: q, mode: "insensitive" } },
            ...(ncmDigits.length >= 4 ? [{ ncm: { contains: ncmDigits } }] : []),
          ],
        }
      : {}),
  };
}

export async function listAuditedProducts(companyId: string, batchId: string, requestUrl: URL) {
  const params = parseProductListParams(requestUrl);
  return withTenant(companyId, async (db) => {
    const batch = await db.importBatch.findFirst({
      where: { id: batchId, companyId },
      select: { id: true },
    });
    if (!batch) {
      throw new HttpError(404, "NOT_FOUND", "Lote não encontrado.");
    }
    const baseWhere = searchWhere(companyId, batchId, params.q, params.ncm, params.tratado);
    const listWhere: Prisma.ProductWhereInput = {
      ...baseWhere,
      ...(params.status ? { auditStatus: params.status } : { auditStatus: { not: null } }),
    };
    const [catalogTotal, grouped, total, rows] = await Promise.all([
      db.product.count({
        where: { companyId, importBatchId: batchId, auditStatus: { not: null } },
      }),
      db.product.groupBy({
        by: ["auditStatus"],
        where: baseWhere,
        _count: { _all: true },
      }),
      db.product.count({ where: listWhere }),
      db.product.findMany({
        where: listWhere,
        orderBy: { codigo: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: productSelect,
      }),
    ]);
    const summary = {
      total: grouped.reduce((acc, row) => acc + row._count._all, 0),
      corretos: grouped.find((row) => row.auditStatus === "CORRETO")?._count._all ?? 0,
      divergentes: grouped.find((row) => row.auditStatus === "DIVERGENTE")?._count._all ?? 0,
      analise: grouped.find((row) => row.auditStatus === "NECESSITA_ANALISE")?._count._all ?? 0,
    };
    const empty = {
      items: [],
      summary,
      catalogTotal,
      total,
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
    };
    if (rows.length === 0) {
      return empty;
    }
    const ncms = [...new Set(rows.map((row) => row.ncm))];
    const { rules, links } = await loadRulesAndLinks(
      db,
      companyId,
      ncms,
      rows.map((row) => row.id),
    );
    const rulesByNcm = indexRules(rules);
    const linkByProduct = new Map(links.map((l) => [l.productId, l.ruleId]));
    const items = rows.map((row) => {
      const product = {
        ...productFromDb(row),
        id: row.id,
        auditStatus: row.auditStatus,
        auditMotivo: row.auditMotivo,
        treatedAt: row.treatedAt,
        treatedStale: row.treatedStale,
        treatedNote: row.treatedNote,
      };
      return sheetItemFromPersisted(
        product,
        rulesByNcm.get(product.ncm) ?? [],
        linkByProduct.get(row.id) ?? null,
      );
    });
    return {
      items,
      summary,
      catalogTotal,
      total,
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
    };
  });
}

export async function listNcmSummary(companyId: string, batchId: string, requestUrl: URL) {
  const params = parseProductListParams(requestUrl);
  return withTenant(companyId, async (db) => {
    const batch = await db.importBatch.findFirst({
      where: { id: batchId, companyId },
      select: { id: true },
    });
    if (!batch) {
      throw new HttpError(404, "NOT_FOUND", "Lote não encontrado.");
    }
    const where: Prisma.ProductWhereInput = {
      companyId,
      importBatchId: batchId,
      auditStatus: params.status ? params.status : { not: null },
      ...treatedWhere(params.tratado),
    };
    const grouped = await db.product.groupBy({
      by: ["ncm", "auditStatus"],
      where,
      _count: { _all: true },
    });
    const byNcm = new Map<
      string,
      { ncm: string; total: number; corretos: number; divergentes: number; analise: number }
    >();
    for (const row of grouped) {
      const current = byNcm.get(row.ncm) ?? {
        ncm: row.ncm,
        total: 0,
        corretos: 0,
        divergentes: 0,
        analise: 0,
      };
      current.total += row._count._all;
      if (row.auditStatus === "CORRETO") current.corretos += row._count._all;
      if (row.auditStatus === "DIVERGENTE") current.divergentes += row._count._all;
      if (row.auditStatus === "NECESSITA_ANALISE") current.analise += row._count._all;
      byNcm.set(row.ncm, current);
    }
    const groups = [...byNcm.values()].sort(
      (a, b) => b.divergentes + b.analise - (a.divergentes + a.analise) || a.ncm.localeCompare(b.ncm),
    );
    return {
      ncmCount: groups.length,
      productCount: groups.reduce((acc, row) => acc + row.total, 0),
      groups,
    };
  });
}

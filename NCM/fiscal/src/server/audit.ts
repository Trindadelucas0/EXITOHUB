import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";
import {
  compareProduct,
  completeRuleDestinos,
  summarizeStatus,
  type CompareResult,
  type FiscalRule,
  type ImportedProduct,
} from "./compare";
import { productFromDb, ruleFromDb } from "./audit-map";
import { LONG_TX, withTenant } from "./db";
import { isJunkRow } from "./import-cadastro";
import { isEgaplastCompany } from "./company-slug";
import {
  parseProductListParams,
  auditCounterDeltas,
  ncmSearchDigits,
  treatedWhere,
} from "./product-query";
import type { StatusFiscal } from "@/src/lib/fiscal";
import {
  SEGMENTO_FORA,
  canonicalSegmentoName,
  ncmFilterForSegmento,
  segmentoIdFromRule,
  segmentoLabel,
} from "@/src/lib/segmento";
import { HttpError } from "./tenant";

export type ProductSheetLayout = "unica" | "matriz" | "egaplast";

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
  abreviacao: true,
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

function sheetFiscalPair(product: ImportedProduct, rule: FiscalRule | null) {
  return {
    importado: {
      cstCompra: product.cstCompra ?? null,
      cstUnico: product.cstUnico ?? null,
      ivaMva: product.ivaMva ?? null,
      destinosCst: product.destinosCst ?? null,
      abreviacao: product.abreviacao ?? null,
      cest: product.cest ?? null,
      aliquotaIcms: product.aliquotaIcms ?? null,
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
          abreviacao: rule.abreviacao ?? null,
          cest: rule.cest ?? null,
          aliquotaIcms: rule.ufTributacao?.DF.aliqInterna ?? null,
        }
      : null,
  };
}

export function sheetItemFromCompare(
  product: ImportedProduct & { id: string },
  compare: CompareResult,
  includeDiffs: boolean,
  treated?: { treated: boolean; treatedStale: boolean; treatedNote: string | null },
) {
  const pair = sheetFiscalPair(product, compare.rule);
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
    segmento: compare.rule?.segmento?.trim() || null,
    diffs: includeDiffs ? compare.diffs : [],
    treated: treated?.treated ?? false,
    treatedStale: treated?.treatedStale ?? false,
    treatedNote: treated?.treatedNote ?? null,
    ...pair,
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
  const rawRule =
    rulesForNcm.find((item) => item.id === linkedRuleId) ??
    (rulesForNcm.length === 1 ? rulesForNcm[0] : null);
  const rule = rawRule ? completeRuleDestinos(rawRule) : null;
  const pair = sheetFiscalPair(product, rule);
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
    segmento: rule?.segmento?.trim() || null,
    diffs: [] as CompareResult["diffs"],
    treated: Boolean(product.treatedAt),
    treatedStale: product.treatedStale,
    treatedNote: product.treatedNote,
    ...pair,
    candidates: [],
  };
}

function compareOpts(slug: string) {
  return isEgaplastCompany(slug) ? { companySlug: "egaplast" } : {};
}

async function loadCompanySlug(
  db: import("@prisma/client").PrismaClient,
  companyId: string,
): Promise<string> {
  const row = await db.company.findFirst({
    where: { id: companyId },
    select: { slug: true },
  });
  return row?.slug ?? "";
}

async function resolveSheetLayout(
  db: import("@prisma/client").PrismaClient,
  companyId: string,
): Promise<ProductSheetLayout> {
  const slug = await loadCompanySlug(db, companyId);
  if (isEgaplastCompany(slug)) return "egaplast";
  const unica = await db.fiscalNcmRule.findFirst({
    where: { companyId, situacaoCodigo: "TRIBUTACAO_UF" },
    select: { id: true },
  });
  return unica ? "unica" : "matriz";
}

function usesSegmentoFilter(layout: ProductSheetLayout): boolean {
  return layout === "unica" || layout === "egaplast";
}

export async function productSheetLayout(companyId: string): Promise<ProductSheetLayout> {
  return withTenant(companyId, async (db) => resolveSheetLayout(db, companyId));
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
      const slug = await loadCompanySlug(db, companyId);
      const opts = compareOpts(slug);
      return products
        .filter((row) => !isJunkRow(row.codigo, row.descricao))
        .map((row) => {
          const product = { ...productFromDb(row), id: row.id };
          const compare = compareProduct(
            product,
            rulesByNcm.get(product.ncm) ?? [],
            linkByProduct.get(row.id) ?? null,
            opts,
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

/** Religa todos os lotes da empresa à base fiscal atual (após importar/editar regra). */
export async function rescoreCompanyBatches(companyId: string) {
  const batches = await withTenant(companyId, (db) =>
    db.importBatch.findMany({
      where: { companyId },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
  );
  for (const batch of batches) {
    await persistBatchSummary(companyId, batch.id);
  }
  return { batchesResynced: batches.length };
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
      const slug = await loadCompanySlug(db, companyId);
      const compare = compareProduct(
        productFromDb(productRow),
        indexRules(rules).get(productRow.ncm) ?? [],
        links[0]?.ruleId ?? null,
        compareOpts(slug),
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

function prismaWhereForSegmento(filter: { mode: "in" | "notIn"; ncms: string[] }): Prisma.ProductWhereInput {
  if (filter.mode === "notIn") {
    return filter.ncms.length > 0 ? { ncm: { notIn: filter.ncms } } : {};
  }
  return { ncm: { in: filter.ncms } };
}

async function unicaSegmentoWhere(
  db: PrismaClient,
  companyId: string,
  segmento: string,
  isUnica: boolean,
): Promise<Prisma.ProductWhereInput> {
  if (!segmento || !isUnica) return {};
  const rules = await db.fiscalNcmRule.findMany({
    where: { companyId },
    select: { ncm: true, segmento: true },
  });
  return prismaWhereForSegmento(ncmFilterForSegmento(rules, segmento));
}

function searchWhere(
  companyId: string,
  batchId: string,
  q: string,
  ncmFilter: string,
  tratado: ReturnType<typeof parseProductListParams>["tratado"],
): Prisma.ProductWhereInput {
  const qLower = q.toLowerCase();
  const ncmDigits = ncmSearchDigits(q);
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
    const layout = await resolveSheetLayout(db, companyId);
    const segmentoWhere = await unicaSegmentoWhere(
      db,
      companyId,
      params.segmento,
      usesSegmentoFilter(layout),
    );
    const searched = searchWhere(companyId, batchId, params.q, params.ncm, params.tratado);
    const baseWhere: Prisma.ProductWhereInput = Object.keys(segmentoWhere).length
      ? { AND: [searched, segmentoWhere] }
      : searched;
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
      layout,
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
      layout,
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
    const layout = await resolveSheetLayout(db, companyId);
    const segmentoWhere = await unicaSegmentoWhere(
      db,
      companyId,
      params.segmento,
      usesSegmentoFilter(layout),
    );
    const where: Prisma.ProductWhereInput = {
      companyId,
      importBatchId: batchId,
      auditStatus: params.status ? params.status : { not: null },
      ...treatedWhere(params.tratado),
      ...(Object.keys(segmentoWhere).length ? { AND: [segmentoWhere] } : {}),
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

export async function listSegmentoSummary(companyId: string, batchId: string, requestUrl: URL) {
  const params = parseProductListParams(requestUrl);
  return withTenant(companyId, async (db) => {
    const batch = await db.importBatch.findFirst({
      where: { id: batchId, companyId },
      select: { id: true },
    });
    if (!batch) {
      throw new HttpError(404, "NOT_FOUND", "Lote não encontrado.");
    }
    const layout = await resolveSheetLayout(db, companyId);
    if (!usesSegmentoFilter(layout)) {
      return { unica: false as const, layout, segmentoCount: 0, productCount: 0, groups: [] };
    }
    const where: Prisma.ProductWhereInput = {
      companyId,
      importBatchId: batchId,
      auditStatus: params.status ? params.status : { not: null },
      ...treatedWhere(params.tratado),
    };
    const [grouped, rules] = await Promise.all([
      db.product.groupBy({
        by: ["ncm", "auditStatus"],
        where,
        _count: { _all: true },
      }),
      db.fiscalNcmRule.findMany({
        where: { companyId },
        select: { ncm: true, segmento: true },
      }),
    ]);
    const ncmToId = new Map<string, string>();
    const namesById = new Map<string, string[]>();
    const regrasById = new Map<string, Set<string>>();
    for (const rule of rules) {
      const id = segmentoIdFromRule(rule.segmento);
      if (!ncmToId.has(rule.ncm)) ncmToId.set(rule.ncm, id);
      const names = namesById.get(id) ?? [];
      names.push(rule.segmento);
      namesById.set(id, names);
      const ncms = regrasById.get(id) ?? new Set<string>();
      ncms.add(rule.ncm);
      regrasById.set(id, ncms);
    }
    type Group = {
      id: string;
      label: string;
      total: number;
      corretos: number;
      divergentes: number;
      analise: number;
      regras: number;
    };
    const byId = new Map<string, Group>();
    function ensure(id: string): Group {
      const current = byId.get(id);
      if (current) return current;
      const created: Group = {
        id,
        label: segmentoLabel(id, canonicalSegmentoName(namesById.get(id) ?? [])),
        total: 0,
        corretos: 0,
        divergentes: 0,
        analise: 0,
        regras: regrasById.get(id)?.size ?? 0,
      };
      byId.set(id, created);
      return created;
    }
    for (const row of grouped) {
      const id = ncmToId.get(row.ncm) ?? SEGMENTO_FORA;
      const current = ensure(id);
      current.total += row._count._all;
      if (row.auditStatus === "CORRETO") current.corretos += row._count._all;
      if (row.auditStatus === "DIVERGENTE") current.divergentes += row._count._all;
      if (row.auditStatus === "NECESSITA_ANALISE") current.analise += row._count._all;
    }
    const groups = [...byId.values()]
      .filter((group) => group.total > 0)
      .sort(
        (a, b) =>
          b.divergentes + b.analise - (a.divergentes + a.analise) ||
          b.total - a.total ||
          a.label.localeCompare(b.label, "pt-BR"),
      );
    return {
      unica: true as const,
      layout,
      segmentoCount: groups.length,
      productCount: groups.reduce((acc, row) => acc + row.total, 0),
      groups,
    };
  });
}

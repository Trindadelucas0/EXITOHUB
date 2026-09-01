import { PrismaClient } from "@prisma/client";
import { productFromDb, ruleFromDb } from "../src/server/audit-map";
import { compareProduct, summarizeStatus, type FiscalRule } from "../src/server/compare";
import { isJunkRow } from "../src/server/import-cadastro";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({ where: { slug: "egaplast" } });
  if (!company) throw new Error("Empresa Egaplast não encontrada");
  await prisma.$executeRaw`SELECT set_config('app.company_id', ${company.id}, false)`;

  const batches = await prisma.importBatch.findMany({
    where: { companyId: company.id },
    select: { id: true, fileName: true },
    orderBy: { createdAt: "desc" },
  });
  const [rules, links] = await Promise.all([
    prisma.fiscalNcmRule.findMany({ where: { companyId: company.id } }),
    prisma.productRuleLink.findMany({ where: { companyId: company.id } }),
  ]);
  const rulesByNcm = new Map<string, FiscalRule[]>();
  for (const rule of rules) {
    const mapped = ruleFromDb(rule);
    const list = rulesByNcm.get(mapped.ncm) ?? [];
    list.push(mapped);
    rulesByNcm.set(mapped.ncm, list);
  }
  const linkByProduct = new Map(links.map((link) => [link.productId, link.ruleId]));

  for (const batch of batches) {
    const products = await prisma.product.findMany({
      where: { companyId: company.id, importBatchId: batch.id },
    });
    const usable = products
      .filter((row) => !isJunkRow(row.codigo, row.descricao))
      .map((row) => {
        const product = { ...productFromDb(row), id: row.id };
        const compare = compareProduct(
          product,
          rulesByNcm.get(product.ncm) ?? [],
          linkByProduct.get(row.id) ?? null,
          { companySlug: "egaplast" },
        );
        return { product, compare };
      });
    const totals = summarizeStatus(usable.map((item) => item.compare));
    for (const item of usable) {
      await prisma.product.updateMany({
        where: { id: item.product.id, companyId: company.id, importBatchId: batch.id },
        data: { auditStatus: item.compare.status, auditMotivo: item.compare.motivo },
      });
    }
    await prisma.importBatch.updateMany({
      where: { id: batch.id, companyId: company.id },
      data: {
        totalRows: usable.length,
        corretos: totals.corretos,
        divergentes: totals.divergentes,
        analise: totals.analise,
      },
    });
    const sample = usable.find((item) => item.product.codigo === "190001");
    console.log(
      JSON.stringify({
        fileName: batch.fileName,
        ...totals,
        product190001: sample
          ? { status: sample.compare.status, motivo: sample.compare.motivo, diffs: sample.compare.diffs.length }
          : null,
      }),
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { productFromDb, ruleFromDb } from "../src/server/audit-map";
import { compareProduct, summarizeStatus, type FiscalRule } from "../src/server/compare";
import { isJunkRow } from "../src/server/import-cadastro";

config();

const prisma = new PrismaClient();

async function withCompany<T>(companyId: string, fn: () => Promise<T>): Promise<T> {
  await prisma.$executeRaw`SELECT set_config('app.company_id', ${companyId}, false)`;
  return fn();
}

async function persistBatch(companyId: string, batchId: string) {
  await withCompany(companyId, async () => {
    const [products, rules, links] = await Promise.all([
      prisma.product.findMany({
        where: { companyId, importBatchId: batchId },
        orderBy: { codigo: "asc" },
      }),
      prisma.fiscalNcmRule.findMany({ where: { companyId } }),
      prisma.productRuleLink.findMany({ where: { companyId } }),
    ]);
    const rulesByNcm = new Map<string, FiscalRule[]>();
    for (const rule of rules) {
      const mapped = ruleFromDb(rule);
      const list = rulesByNcm.get(mapped.ncm) ?? [];
      list.push(mapped);
      rulesByNcm.set(mapped.ncm, list);
    }
    const linkByProduct = new Map(links.map((link) => [link.productId, link.ruleId]));
    const usable = products
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
    const totals = summarizeStatus(usable.map((item) => item.compare));
    const chunkSize = 200;
    for (let i = 0; i < usable.length; i += chunkSize) {
      const slice = usable.slice(i, i + chunkSize);
      for (const item of slice) {
        await prisma.product.updateMany({
          where: { id: item.product.id, companyId, importBatchId: batchId },
          data: {
            auditStatus: item.compare.status,
            auditMotivo: item.compare.motivo,
          },
        });
      }
    }
    await prisma.importBatch.updateMany({
      where: { id: batchId, companyId },
      data: {
        totalRows: usable.length,
        corretos: totals.corretos,
        divergentes: totals.divergentes,
        analise: totals.analise,
      },
    });
  });
}

async function listCompanies(): Promise<{ id: string; name: string }[]> {
  const { Client } = await import("pg");
  const password = process.env.DB_PASSWORD;
  if (!password) throw new Error("DB_PASSWORD ausente no .env");
  const client = new Client({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? "5432"),
    user: process.env.DB_USER ?? "postgres",
    password,
    database: process.env.DB_NAME ?? "fiscal-p",
  });
  await client.connect();
  try {
    const result = await client.query<{ id: string; name: string }>(
      "SELECT id, name FROM companies ORDER BY name",
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

async function main() {
  const companies = await listCompanies();

  if (companies.length === 0) {
    console.log("Nenhuma empresa encontrada.");
    return;
  }

  for (const company of companies) {
    await withCompany(company.id, async () => {
      const batches = await prisma.importBatch.findMany({
        where: { companyId: company.id },
        select: { id: true, fileName: true },
        orderBy: { createdAt: "asc" },
      });
      for (const batch of batches) {
        console.log(`Recalculando auditoria: ${company.name} · ${batch.fileName}`);
        await persistBatch(company.id, batch.id);
      }
    });
  }
  console.log("Backfill de audit_status concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

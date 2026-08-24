import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { parseCadastroBuffer, sanitizeFileName } from "../src/server/import-cadastro";

config();

const prisma = new PrismaClient();

async function main() {
  const filePath =
    process.argv[2] || path.join(process.cwd(), "data", "cadastro-cliente-baifer.xlsx");
  const buffer = readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const products = parseCadastroBuffer(buffer, ext);
  if (products.length === 0) {
    throw new Error("Nenhuma linha de cadastro reconhecida.");
  }

  const company = await prisma.company.findFirst({ where: { slug: "baifer" } });
  if (!company) {
    throw new Error("Empresa BAIFER não encontrada. Rode npm run db:seed primeiro.");
  }
  const admin = await prisma.user.findFirst({
    where: { companyId: company.id, role: "admin" },
  });
  if (!admin) {
    throw new Error("Usuário admin da BAIFER não encontrado.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.company_id', ${company.id}, true)`;
    const batch = await tx.importBatch.create({
      data: {
        companyId: company.id,
        userId: admin.id,
        fileName: sanitizeFileName(path.basename(filePath)),
        totalRows: products.length,
      },
    });
    const chunkSize = 200;
    for (let i = 0; i < products.length; i += chunkSize) {
      const slice = products.slice(i, i + chunkSize);
      await tx.product.createMany({
        data: slice.map((item) => ({
          companyId: company.id,
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
        })),
      });
    }
    const rules = await tx.fiscalNcmRule.count({ where: { companyId: company.id } });
    const count = await tx.product.count({
      where: { companyId: company.id, importBatchId: batch.id },
    });
    console.log(
      `Import OK: lote ${batch.id} com ${count} produtos de ${path.basename(filePath)}. Base NCM intacta: ${rules} regras. Lotes anteriores foram mantidos.`,
    );
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

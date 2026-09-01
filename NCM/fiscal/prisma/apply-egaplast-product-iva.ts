import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Patch = {
  codigo: string;
  ncm: string;
  cstUnico: string | null;
  origem: string | null;
  ivaPorUf: Record<string, string | null> | null;
  ivaMva: string | null;
  ivaMvaNumero: number | null;
};

async function main() {
  const patchPath = process.argv[2] || path.join(process.cwd(), "data", "egaplast-iva-patch.json");
  const patches = JSON.parse(readFileSync(patchPath, "utf8")) as Patch[];
  const byCodigo = new Map(patches.map((item) => [item.codigo, item]));
  const company = await prisma.company.findFirst({ where: { slug: "egaplast" } });
  if (!company) throw new Error("Empresa Egaplast não encontrada");

  await prisma.$executeRaw`SELECT set_config('app.company_id', ${company.id}, false)`;

  const products = await prisma.product.findMany({
    where: { companyId: company.id, codigo: { in: [...byCodigo.keys()] } },
    select: { id: true, codigo: true },
  });

  let updated = 0;
  for (const product of products) {
    const patch = byCodigo.get(product.codigo);
    if (!patch?.ivaPorUf) continue;
    await prisma.product.update({
      where: { id: product.id },
      data: {
        ivaPorUf: patch.ivaPorUf as Prisma.InputJsonValue,
        ivaMva: patch.ivaMva,
        ivaMvaNumero: patch.ivaMvaNumero,
        origem: patch.origem,
        cstUnico: patch.cstUnico,
      },
    });
    updated += 1;
  }

  const sample = await prisma.product.findFirst({
    where: { companyId: company.id, codigo: "190001" },
    select: { id: true, ncm: true, cstUnico: true, ivaPorUf: true },
  });
  console.log(
    JSON.stringify(
      {
        patchRows: patches.length,
        matchedProducts: products.length,
        updated,
        product190001: sample
          ? {
              ncm: sample.ncm,
              cstUnico: sample.cstUnico,
              sp: (sample.ivaPorUf as { SP?: string } | null)?.SP ?? null,
              rr: (sample.ivaPorUf as { RR?: string } | null)?.RR ?? null,
            }
          : null,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const slug = "teste-e2e";

const company = await prisma.company.findFirst({ where: { slug }, select: { id: true, name: true } });
if (!company) {
  console.log(`Nada a remover: empresa ${slug} não existe.`);
} else {
  const id = company.id;
  await prisma.$executeRaw`SELECT set_config('app.company_id', ${id}, false)`;
  const links = await prisma.productRuleLink.deleteMany({ where: { companyId: id } });
  const products = await prisma.product.deleteMany({ where: { companyId: id } });
  const batches = await prisma.importBatch.deleteMany({ where: { companyId: id } });
  const rules = await prisma.fiscalNcmRule.deleteMany({ where: { companyId: id } });
  const sessions = await prisma.session.deleteMany({
    where: { OR: [{ companyId: id }, { activeCompanyId: id }] },
  });
  const users = await prisma.user.deleteMany({ where: { companyId: id } });
  const removed = await prisma.company.deleteMany({ where: { id } });
  console.log(
    JSON.stringify(
      {
        empresa: company.name,
        links: links.count,
        products: products.count,
        batches: batches.count,
        rules: rules.count,
        sessions: sessions.count,
        users: users.count,
        company: removed.count,
      },
      null,
      1,
    ),
  );
}

const restantes = await prisma.company.findMany({ select: { slug: true, name: true } });
console.log("empresas restantes:", JSON.stringify(restantes));
await prisma.$disconnect();

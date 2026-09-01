import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { classifyRuleSync } from "../src/server/seed-policy";

const prisma = new PrismaClient();

type IncomingRule = {
  ncm: string;
  ncmOriginal: string;
  segmento: string;
  cstEntrada: string | null;
  cstSaida: string | null;
  cfopSaida: string | null;
  destinosCst: unknown;
  situacao: string;
  situacaoCodigo: string;
  mvaPercentual: number | null;
  mvaTexto: string | null;
  mvaKind: string;
  observacao: string | null;
  cest?: string | null;
  ipi?: string | null;
  abreviacao?: string | null;
  reducao?: boolean;
  reducaoPercentual?: number | null;
  ufTributacao?: unknown;
  ivaPorUf?: unknown;
  ivaPorUfImportado?: unknown;
};

async function main() {
  const raw = JSON.parse(readFileSync(path.join(process.cwd(), "data", "base-egaplast.json"), "utf8")) as {
    company: string;
    rules: IncomingRule[];
  };
  if (raw.company !== "egaplast") {
    throw new Error(`JSON inesperado: ${raw.company}`);
  }
  const company = await prisma.company.findFirst({ where: { slug: "egaplast" } });
  if (!company) throw new Error("Empresa Egaplast não encontrada");
  const companyId = company.id;

  await prisma.$executeRaw`SELECT set_config('app.company_id', ${companyId}, false)`;

  const incomingByKey = new Map(raw.rules.map((rule) => [`${rule.ncm}::${rule.situacaoCodigo}`, rule]));
  const uniqueIncoming = [...incomingByKey.values()];
  const existingRows = await prisma.fiscalNcmRule.findMany({
    where: { companyId },
    select: { id: true, ncm: true, situacaoCodigo: true, _count: { select: { links: true } } },
  });
  const existing = existingRows.map((row) => ({
    id: row.id,
    ncm: row.ncm,
    situacaoCodigo: row.situacaoCodigo,
    linked: row._count.links > 0,
  }));
  const plan = classifyRuleSync(
    uniqueIncoming.map((rule) => ({ ncm: rule.ncm, situacaoCodigo: rule.situacaoCodigo })),
    existing,
    { keepSituacaoCodigos: ["TRIBUTACAO_UF"] },
  );

  function ruleData(rule: IncomingRule) {
    return {
      companyId,
      ncm: rule.ncm,
      ncmOriginal: rule.ncmOriginal,
      segmento: rule.segmento,
      cstEntrada: rule.cstEntrada,
      cstSaida: rule.cstSaida,
      cfopSaida: rule.cfopSaida,
      destinosCst: rule.destinosCst as Prisma.InputJsonValue,
      situacao: rule.situacao,
      situacaoCodigo: rule.situacaoCodigo,
      mvaPercentual: rule.mvaPercentual,
      mvaTexto: rule.mvaTexto,
      mvaKind: rule.mvaKind,
      observacao: rule.observacao,
      cest: rule.cest ?? null,
      ipi: rule.ipi ?? null,
      abreviacao: rule.abreviacao ?? null,
      reducao: Boolean(rule.reducao),
      reducaoPercentual: rule.reducaoPercentual ?? null,
      ufTributacao: (rule.ufTributacao as Prisma.InputJsonValue) ?? Prisma.DbNull,
      ivaPorUf: (rule.ivaPorUf as Prisma.InputJsonValue) ?? Prisma.DbNull,
      ivaPorUfImportado: (rule.ivaPorUfImportado as Prisma.InputJsonValue) ?? Prisma.DbNull,
    };
  }

  let updated = 0;
  for (const item of plan.toUpdate) {
    const rule = incomingByKey.get(`${item.ncm}::${item.situacaoCodigo}`);
    if (!rule) continue;
    await prisma.fiscalNcmRule.update({ where: { id: item.id }, data: ruleData(rule) });
    updated += 1;
  }
  if (plan.toInsert.length > 0) {
    await prisma.fiscalNcmRule.createMany({
      data: plan.toInsert.map((key) => {
        const rule = incomingByKey.get(`${key.ncm}::${key.situacaoCodigo}`);
        if (!rule) throw new Error("Regra de insert ausente");
        return ruleData(rule);
      }),
    });
  }

  const ncm4012 = await prisma.fiscalNcmRule.findMany({
    where: { companyId, ncm: "40129090" },
    select: { situacaoCodigo: true, cstSaida: true, ivaPorUf: true },
  });
  const counts = await prisma.fiscalNcmRule.groupBy({
    by: ["situacaoCodigo"],
    where: { companyId },
    _count: true,
  });
  console.log(
    JSON.stringify(
      {
        inserted: plan.toInsert.length,
        updated,
        skippedDeletes: plan.toDelete.length,
        keptTributacao: plan.toKeepOrphan.filter((item) => item.situacaoCodigo === "TRIBUTACAO_UF").length,
        ncm40129090: ncm4012.map((row) => ({
          situacaoCodigo: row.situacaoCodigo,
          cstSaida: row.cstSaida,
          sp: (row.ivaPorUf as { SP?: string } | null)?.SP ?? null,
        })),
        counts,
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

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  classifyRuleSync,
  shouldWipeCadastro,
  seedDeletionPlan,
} from "../src/server/seed-policy";

config();

type Destinos = {
  naoContribuinte: string | null;
  contribuinte: string | null;
  revenda: string | null;
  construtora: string | null;
  hospClinica: string | null;
  orgaoPublico: string | null;
  produtorRural: string | null;
  atacado: string | null;
};

type ExtractedRule = {
  company: string;
  sourceSheet: string;
  ncm: string;
  ncmOriginal: string;
  segmento: string;
  cstEntrada: string | null;
  cstSaida: string | null;
  cfopSaida: string | null;
  destinosCst: Destinos;
  situacao: string;
  situacaoCodigo: string;
  mvaPercentual: number | null;
  mvaTexto: string | null;
  mvaKind: string;
  observacao: string | null;
};

type ExtractedFile = {
  company: string;
  sheet: string;
  rules: ExtractedRule[];
};

type CompanySeed = {
  id: string;
  slug: string;
  name: string;
  jsonFile: string;
  adminEmail: string;
  consultaEmail: string;
};

const COMPANIES: CompanySeed[] = [
  {
    id: "cm_baifer_seed_company",
    slug: "baifer",
    name: "BAIFER",
    jsonFile: "base-baifer.json",
    adminEmail: "admin@baifer.local",
    consultaEmail: "consulta@baifer.local",
  },
  {
    id: "cm_loja_seed_company",
    slug: "loja",
    name: "Loja das Máquinas",
    jsonFile: "base-loja.json",
    adminEmail: "admin@loja.local",
    consultaEmail: "consulta@loja.local",
  },
];

const prisma = new PrismaClient();

async function withCompany<T>(companyId: string, fn: () => Promise<T>): Promise<T> {
  await prisma.$executeRaw`SELECT set_config('app.company_id', ${companyId}, false)`;
  return fn();
}

function loadRules(file: string, expectedCompany: string): ExtractedFile {
  const jsonPath = path.join(process.cwd(), "data", file);
  const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as ExtractedFile;
  if (raw.company !== expectedCompany) {
    throw new Error(`JSON ${file} é da empresa ${raw.company}, esperado ${expectedCompany}.`);
  }
  if (expectedCompany === "loja" && raw.rules.some((r) => r.sourceSheet !== "LOJA")) {
    throw new Error("JSON da Loja contém aba que não é LOJA.");
  }
  if (expectedCompany === "baifer" && raw.rules.some((r) => r.sourceSheet === "LOJA")) {
    throw new Error("JSON da BAIFER contém aba LOJA.");
  }
  if (raw.rules.some((r) => "codigoProduto" in r || "descricaoProduto" in r)) {
    throw new Error("Seed recusou payload com produtos.");
  }
  return raw;
}

function ruleData(spec: CompanySeed, rule: ExtractedRule) {
  return {
    companyId: spec.id,
    ncm: rule.ncm,
    ncmOriginal: rule.ncmOriginal,
    segmento: rule.segmento,
    cstEntrada: rule.cstEntrada,
    cstSaida: rule.cstSaida,
    cfopSaida: rule.cfopSaida,
    destinosCst: rule.destinosCst,
    situacao: rule.situacao,
    situacaoCodigo: rule.situacaoCodigo,
    mvaPercentual: rule.mvaPercentual,
    mvaTexto: rule.mvaTexto,
    mvaKind: rule.mvaKind,
    observacao: rule.observacao,
  };
}

async function ensureSuperAdmin() {
  const email = process.env.SEED_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "SEED_SUPERADMIN_EMAIL e SEED_SUPERADMIN_PASSWORD são obrigatórios (não commitar senha no código).",
    );
  }
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    if (existing.role !== "superadmin" || existing.companyId) {
      throw new Error(`O e-mail ${email} já existe e não é o administrador do escritório.`);
    }
    console.log(`Seed OK: escritório já cadastrado (${email}).`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      id: "cm_office_superadmin",
      companyId: null,
      email,
      passwordHash,
      name: "Administrador do escritório",
      role: "superadmin",
    },
  });
  console.log(`Seed OK: escritório ${email}`);
}

async function ensureUser(
  spec: CompanySeed,
  id: string,
  email: string,
  name: string,
  role: "admin" | "consulta",
  passwordHash: string,
) {
  const existing = await prisma.user.findFirst({
    where: { email },
  });
  if (existing) {
    if (existing.companyId !== spec.id) {
      throw new Error(`E-mail ${email} já pertence a outra empresa. E-mails são únicos no sistema.`);
    }
    return;
  }
  await prisma.user.create({
    data: {
      id,
      companyId: spec.id,
      email,
      passwordHash,
      name,
      role,
    },
  });
}

async function syncRules(spec: CompanySeed, incoming: ExtractedRule[]) {
  const existingRows = await prisma.fiscalNcmRule.findMany({
    where: { companyId: spec.id },
    select: {
      id: true,
      ncm: true,
      situacaoCodigo: true,
      _count: { select: { links: true } },
    },
  });
  const existing = existingRows.map((row) => ({
    id: row.id,
    ncm: row.ncm,
    situacaoCodigo: row.situacaoCodigo,
    linked: row._count.links > 0,
  }));
  const plan = classifyRuleSync(
    incoming.map((rule) => ({ ncm: rule.ncm, situacaoCodigo: rule.situacaoCodigo })),
    existing,
  );
  const incomingByKey = new Map(
    incoming.map((rule) => [`${rule.ncm}::${rule.situacaoCodigo}`, rule]),
  );

  for (const item of plan.toUpdate) {
    const rule = incomingByKey.get(`${item.ncm}::${item.situacaoCodigo}`);
    if (!rule) continue;
    await prisma.fiscalNcmRule.update({
      where: { id: item.id },
      data: ruleData(spec, rule),
    });
  }
  if (plan.toInsert.length > 0) {
    await prisma.fiscalNcmRule.createMany({
      data: plan.toInsert.map((key) => {
        const rule = incomingByKey.get(`${key.ncm}::${key.situacaoCodigo}`);
        if (!rule) throw new Error("Regra de insert ausente");
        return ruleData(spec, rule);
      }),
    });
  }
  if (plan.toDelete.length > 0) {
    await prisma.fiscalNcmRule.deleteMany({
      where: { companyId: spec.id, id: { in: plan.toDelete.map((item) => item.id) } },
    });
  }
  if (plan.toKeepOrphan.length > 0) {
    console.warn(
      `Seed ${spec.slug}: ${plan.toKeepOrphan.length} regra(s) com vínculo mantidas embora não estejam no JSON.`,
    );
  }
  return { inserted: plan.toInsert.length, updated: plan.toUpdate.length };
}

async function seedCompany(spec: CompanySeed, passwordHash: string, wipeCadastro: boolean) {
  const raw = loadRules(spec.jsonFile, spec.slug);
  await withCompany(spec.id, async () => {
    const deletion = seedDeletionPlan(wipeCadastro);
    if (wipeCadastro) {
      console.warn(`SEED_RESET_CADASTRO=1: apagando lotes e produtos de ${spec.slug}.`);
    }
    if (deletion.links) {
      await prisma.productRuleLink.deleteMany({ where: { companyId: spec.id } });
    }
    if (deletion.products) {
      await prisma.product.deleteMany({ where: { companyId: spec.id } });
    }
    if (deletion.batches) {
      await prisma.importBatch.deleteMany({ where: { companyId: spec.id } });
    }

    await prisma.company.upsert({
      where: { id: spec.id },
      create: { id: spec.id, name: spec.name, slug: spec.slug },
      update: { name: spec.name, slug: spec.slug },
    });
    await ensureUser(spec, `${spec.id}_admin`, spec.adminEmail, "Administrador", "admin", passwordHash);
    await ensureUser(spec, `${spec.id}_consulta`, spec.consultaEmail, "Consulta", "consulta", passwordHash);
    await syncRules(spec, raw.rules);

    const products = await prisma.product.count({ where: { companyId: spec.id } });
    const rules = await prisma.fiscalNcmRule.count({ where: { companyId: spec.id } });
    console.log(
      `Seed OK: ${spec.name} (${spec.slug}) ${rules} regras, ${products} produtos no histórico, admin ${spec.adminEmail}`,
    );
  });
}

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD é obrigatório (não commitar senha no código).");
  }
  const wipeCadastro = shouldWipeCadastro(process.env);
  if (wipeCadastro) {
    console.warn("ATENÇÃO: SEED_RESET_CADASTRO=1 vai apagar lotes importados. Regras e usuários permanecem.");
  }
  await ensureSuperAdmin();
  const hash = await bcrypt.hash(password, 12);
  for (const spec of COMPANIES) {
    await seedCompany(spec, hash, wipeCadastro);
  }
  const baiferRules = await prisma.fiscalNcmRule.count({
    where: { companyId: "cm_baifer_seed_company" },
  });
  const lojaRules = await prisma.fiscalNcmRule.count({ where: { companyId: "cm_loja_seed_company" } });
  console.log(`Conferência: BAIFER ${baiferRules} regras, LOJA ${lojaRules} regras — isoladas por companyId.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

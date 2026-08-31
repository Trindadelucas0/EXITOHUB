import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
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
  cest?: string | null;
  ipi?: string | null;
  abreviacao?: string | null;
  reducao?: boolean;
  reducaoPercentual?: number | null;
  ufTributacao?: unknown;
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
  {
    id: "cm_unica_seed_company",
    slug: "unica",
    name: "Unica",
    jsonFile: "base-unica.json",
    adminEmail: "admin@unica.local",
    consultaEmail: "consulta@unica.local",
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
  if (expectedCompany === "unica" && raw.rules.some((r) => r.sourceSheet === "BAIFER" || r.sourceSheet === "LOJA")) {
    throw new Error("JSON da Unica contém aba BAIFER ou LOJA.");
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
    cest: rule.cest ?? null,
    ipi: rule.ipi ?? null,
    abreviacao: rule.abreviacao ?? null,
    reducao: Boolean(rule.reducao),
    reducaoPercentual: rule.reducaoPercentual ?? null,
    ufTributacao: rule.ufTributacao ?? Prisma.DbNull,
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
  const incomingByKey = new Map(
    incoming.map((rule) => [`${rule.ncm}::${rule.situacaoCodigo}`, rule]),
  );
  const uniqueIncoming = [...incomingByKey.values()];
  const plan = classifyRuleSync(
    uniqueIncoming.map((rule) => ({ ncm: rule.ncm, situacaoCodigo: rule.situacaoCodigo })),
    existing,
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

async function resolveSpec(spec: CompanySeed): Promise<CompanySeed> {
  const bySlug = await prisma.company.findFirst({
    where: { slug: spec.slug },
    select: { id: true },
  });
  if (!bySlug || bySlug.id === spec.id) return spec;
  return { ...spec, id: bySlug.id };
}

async function seedCompany(spec: CompanySeed, passwordHash: string, wipeCadastro: boolean) {
  const raw = loadRules(spec.jsonFile, spec.slug);
  const resolved = await resolveSpec(spec);
  await withCompany(resolved.id, async () => {
    const deletion = seedDeletionPlan(wipeCadastro);
    if (wipeCadastro) {
      console.warn(`SEED_RESET_CADASTRO=1: apagando lotes e produtos de ${resolved.slug}.`);
    }
    if (deletion.links) {
      await prisma.productRuleLink.deleteMany({ where: { companyId: resolved.id } });
    }
    if (deletion.products) {
      await prisma.product.deleteMany({ where: { companyId: resolved.id } });
    }
    if (deletion.batches) {
      await prisma.importBatch.deleteMany({ where: { companyId: resolved.id } });
    }

    await prisma.company.upsert({
      where: { id: resolved.id },
      create: { id: resolved.id, name: resolved.name, slug: resolved.slug },
      update: { name: resolved.name, slug: resolved.slug },
    });
    await ensureUser(resolved, `${resolved.id}_admin`, resolved.adminEmail, "Administrador", "admin", passwordHash);
    await ensureUser(resolved, `${resolved.id}_consulta`, resolved.consultaEmail, "Consulta", "consulta", passwordHash);
    await syncRules(resolved, raw.rules);

    const products = await prisma.product.count({ where: { companyId: resolved.id } });
    const rules = await prisma.fiscalNcmRule.count({ where: { companyId: resolved.id } });
    console.log(
      `Seed OK: ${resolved.name} (${resolved.slug}) ${rules} regras, ${products} produtos no histórico, admin ${resolved.adminEmail}`,
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
    where: { company: { slug: "baifer" } },
  });
  const lojaRules = await prisma.fiscalNcmRule.count({ where: { company: { slug: "loja" } } });
  const unicaRules = await prisma.fiscalNcmRule.count({ where: { company: { slug: "unica" } } });
  console.log(
    `Conferência: BAIFER ${baiferRules} regras, LOJA ${lojaRules} regras, UNICA ${unicaRules} regras — isoladas por companyId.`,
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

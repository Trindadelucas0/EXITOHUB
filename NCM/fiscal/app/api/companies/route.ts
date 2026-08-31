import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "@/src/server/auth";
import { isValidSlug, normalizeSlug } from "@/src/server/company-slug";
import { prisma, withTenant } from "@/src/server/db";
import { jsonError, jsonOk } from "@/src/server/http";
import { provisionNcmHubUser } from "@/src/server/hub-provision";
import { HttpError, requireSuperAdmin, requireUser } from "@/src/server/tenant";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(40),
  adminName: z.string().trim().min(2).max(120).optional(),
  adminEmail: z.string().email().max(180).optional(),
  adminPassword: z.string().min(8).max(200).optional(),
});

const hubCompanySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(40),
});

export async function GET() {
  try {
    const user = await requireUser();
    requireSuperAdmin(user);
    const companies = await prisma.company.findMany({
      select: { id: true, name: true, slug: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    return jsonOk({ companies });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser();
    requireSuperAdmin(actor);
    const raw = await request.json();
    const hubMode = process.env.HUB_MODE === "1";

    if (hubMode) {
      const body = hubCompanySchema.parse(raw);
      const slug = normalizeSlug(body.slug);
      if (!isValidSlug(slug)) {
        throw new HttpError(400, "VALIDATION", "Slug inválido. Use letras, números e hífen.");
      }
      const existing = await prisma.company.findFirst({ where: { slug }, select: { id: true } });
      if (existing) {
        throw new HttpError(409, "CONFLICT", "Já existe uma empresa com este identificador.");
      }
      const companyId = `c${randomBytes(12).toString("hex")}`;
      const company = await withTenant(companyId, async (db) =>
        db.company.create({
          data: { id: companyId, name: body.name.trim(), slug },
          select: { id: true, name: true, slug: true },
        }),
      );
      return jsonOk({ company }, 201);
    }

    const body = createSchema.parse(raw);
    if (!body.adminName || !body.adminEmail || !body.adminPassword) {
      throw new HttpError(400, "VALIDATION", "Informe nome, e-mail e senha do administrador.");
    }
    const slug = normalizeSlug(body.slug);
    if (!isValidSlug(slug)) {
      throw new HttpError(400, "VALIDATION", "Slug inválido. Use letras, números e hífen.");
    }
    const existing = await prisma.company.findFirst({ where: { slug }, select: { id: true } });
    if (existing) {
      throw new HttpError(409, "CONFLICT", "Já existe uma empresa com este identificador.");
    }
    const email = body.adminEmail.trim().toLowerCase();
    const emailTaken = await prisma.user.findFirst({ where: { email }, select: { id: true } });
    if (emailTaken) {
      throw new HttpError(409, "CONFLICT", "Já existe um usuário com este e-mail.");
    }
    const companyId = `c${randomBytes(12).toString("hex")}`;
    const passwordHash = await hashPassword(body.adminPassword);
    const created = await withTenant(companyId, async (db) => {
      const company = await db.company.create({
        data: { id: companyId, name: body.name.trim(), slug },
      });
      const admin = await db.user.create({
        data: {
          companyId,
          email,
          passwordHash,
          name: body.adminName.trim(),
          role: "admin",
        },
        select: { id: true, email: true, name: true, role: true },
      });
      return { company, admin };
    });
    try {
      await provisionNcmHubUser({
        username: email,
        email,
        passwordHash,
        displayName: body.adminName.trim(),
      });
    } catch (hubError) {
      await withTenant(companyId, async (db) => {
        await db.user.deleteMany({ where: { companyId } });
        await db.company.delete({ where: { id: companyId } });
      }).catch(() => undefined);
      throw hubError;
    }
    return jsonOk(
      {
        company: {
          id: created.company.id,
          name: created.company.name,
          slug: created.company.slug,
        },
        admin: created.admin,
      },
      201,
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(new HttpError(409, "CONFLICT", "Empresa ou e-mail já cadastrado."));
    }
    return jsonError(error);
  }
}

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "@/src/server/auth";
import { prisma, withTenant } from "@/src/server/db";
import { jsonError, jsonOk } from "@/src/server/http";
import { HttpError, requireSuperAdmin, requireUser } from "@/src/server/tenant";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(180),
  password: z.string().min(8).max(200),
  role: z.enum(["admin", "consulta"]),
  companyId: z.string().trim().min(1).max(60),
});

async function existingCompanyId(requested: string | undefined) {
  if (!requested) {
    throw new HttpError(400, "VALIDATION", "Informe a empresa do usuário.");
  }
  const company = await prisma.company.findFirst({
    where: { id: requested },
    select: { id: true },
  });
  if (!company) {
    throw new HttpError(404, "NOT_FOUND", "Empresa não encontrada.");
  }
  return company.id;
}

export async function GET(request: Request) {
  try {
    const actor = await requireUser();
    requireSuperAdmin(actor);
    const url = new URL(request.url);
    const companyId = await existingCompanyId(url.searchParams.get("companyId") ?? undefined);
    const users = await withTenant(companyId, (db) =>
      db.user.findMany({
        where: { companyId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
    );
    return jsonOk({ users });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser();
    requireSuperAdmin(actor);
    const body = createSchema.parse(await request.json());
    const companyId = await existingCompanyId(body.companyId);
    const email = body.email.trim().toLowerCase();
    const passwordHash = await hashPassword(body.password);
    const duplicate = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (duplicate) {
      throw new HttpError(409, "CONFLICT", "Já existe um usuário com este e-mail.");
    }
    const created = await withTenant(companyId, async (db) => {
      return db.user.create({
        data: {
          companyId,
          email,
          passwordHash,
          name: body.name.trim(),
          role: body.role,
        },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
    });
    return jsonOk({ user: created }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(new HttpError(409, "CONFLICT", "Já existe um usuário com este e-mail."));
    }
    return jsonError(error);
  }
}

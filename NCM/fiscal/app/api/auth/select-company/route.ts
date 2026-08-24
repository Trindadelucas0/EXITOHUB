import { z } from "zod";
import { readSessionCookie, setActiveCompany } from "@/src/server/auth";
import { prisma } from "@/src/server/db";
import { jsonError, jsonOk } from "@/src/server/http";
import { HttpError, requireSuperAdmin, requireUser } from "@/src/server/tenant";

const schema = z.object({
  companyId: z.string().trim().min(1).max(60),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    requireSuperAdmin(user);
    const body = schema.parse(await request.json());
    const company = await prisma.company.findFirst({
      where: { id: body.companyId },
      select: { id: true, name: true, slug: true },
    });
    if (!company) {
      throw new HttpError(404, "NOT_FOUND", "Empresa não encontrada.");
    }
    await setActiveCompany(await readSessionCookie(), company.id);
    return jsonOk({ company, redirectTo: "/dashboard" });
  } catch (error) {
    return jsonError(error);
  }
}

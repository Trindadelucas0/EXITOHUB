import { NextResponse } from "next/server";
import { z } from "zod";
import {
  openCompanySession,
  readSessionCookie,
  setActiveCompany,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/src/server/auth";
import { withBasePath } from "@/src/lib/base-path";
import { prisma } from "@/src/server/db";
import { jsonError, jsonOk } from "@/src/server/http";
import { HttpError, requireSuperAdmin, requireUser } from "@/src/server/tenant";

const schema = z.object({
  companyId: z.string().trim().min(1).max(60),
});

async function readCompanyId(request: Request): Promise<{ companyId: string; html: boolean }> {
  const ctype = request.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const body = schema.parse(await request.json());
    return { companyId: body.companyId, html: false };
  }
  const form = await request.formData();
  return {
    companyId: schema.parse({ companyId: String(form.get("companyId") || "") }).companyId,
    html: true,
  };
}

export async function POST(request: Request) {
  let html = false;
  try {
    const parsed = await readCompanyId(request);
    html = parsed.html;
    const user = await requireUser();
    requireSuperAdmin(user);
    const company = await prisma.company.findFirst({
      where: { id: parsed.companyId },
      select: { id: true, name: true, slug: true },
    });
    if (!company) {
      throw new HttpError(404, "NOT_FOUND", "Empresa não encontrada.");
    }

    const existing = await readSessionCookie();
    const updated = await setActiveCompany(existing, company.id);
    const token = updated
      ? existing
      : (await openCompanySession(user, company.id)).token;
    if (!token) {
      throw new HttpError(500, "SESSION", "Não foi possível abrir a empresa.");
    }
    console.log("[ncm] empresa aberta", company.slug, company.id);

    if (html) {
      const location = new URL(withBasePath("/dashboard"), request.url);
      const response = NextResponse.redirect(location, 303);
      if (!updated) {
        response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
      }
      return response;
    }

    const response = jsonOk({ company, redirectTo: "/dashboard" });
    if (!updated) {
      response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    }
    return response;
  } catch (error) {
    if (html) {
      const message = error instanceof HttpError ? error.message : "Não foi possível abrir a empresa.";
      const location = new URL(
        `${withBasePath("/escritorio/empresas")}?erro=${encodeURIComponent(message)}`,
        request.url,
      );
      return NextResponse.redirect(location, 303);
    }
    return jsonError(error);
  }
}

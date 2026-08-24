import "server-only";

import { notFound } from "next/navigation";
import type { AuthUser } from "./auth";
import { getCurrentUser } from "./auth";
import { canWriteCompany, resolveCompanyScope } from "./company-scope";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Requisição já resolvida para uma empresa: companyId aqui é o tenant efetivo. */
export type CompanySession = {
  id: string;
  email: string;
  name: string;
  role: AuthUser["role"];
  companyId: string;
  companyName: string;
  fromOffice: boolean;
};

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, "UNAUTHORIZED", "Sessão inválida ou expirada.");
  }
  return user;
}

export function requireSuperAdmin(user: AuthUser): void {
  if (user.role !== "superadmin") {
    throw new HttpError(403, "FORBIDDEN", "Esta ação exige o administrador do escritório.");
  }
}

export async function requireCompanySession(): Promise<CompanySession> {
  const user = await requireUser();
  const scope = resolveCompanyScope(user);
  if (!scope) {
    throw new HttpError(
      403,
      "COMPANY_REQUIRED",
      user.role === "superadmin"
        ? "Escolha a empresa no painel do escritório antes de abrir a conferência."
        : "Esta ação é da empresa. Entre com o login cadastrado nela.",
    );
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: scope.companyId,
    companyName: scope.companyName,
    fromOffice: scope.fromOffice,
  };
}

export function requireCompanyAdmin(session: CompanySession): void {
  const scope = {
    companyId: session.companyId,
    companyName: session.companyName,
    fromOffice: session.fromOffice,
  };
  if (!canWriteCompany(session.role, scope)) {
    throw new HttpError(403, "FORBIDDEN", "Esta ação exige perfil administrador da empresa.");
  }
}

export function tenantWhere(companyId: string) {
  if (!companyId) {
    throw new HttpError(400, "TENANT_REQUIRED", "Empresa ativa não informada.");
  }
  return { companyId };
}

export function ownedWhere(id: string, companyId: string) {
  if (!companyId) {
    throw new HttpError(400, "TENANT_REQUIRED", "Empresa ativa não informada.");
  }
  return { id, companyId };
}

export async function requirePageUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }
  return user;
}

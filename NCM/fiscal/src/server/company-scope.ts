import type { AuthUser } from "./auth";

export type CompanyScope = {
  companyId: string;
  companyName: string;
  /** true quando é o escritório operando dentro da empresa que ele abriu. */
  fromOffice: boolean;
};

/**
 * Empresa em que a requisição pode mexer. Null quando não há empresa legítima:
 * escritório sem empresa aberta, ou usuário sem vínculo.
 */
export function resolveCompanyScope(user: AuthUser): CompanyScope | null {
  if (user.role === "superadmin") {
    if (!user.activeCompanyId) return null;
    return {
      companyId: user.activeCompanyId,
      companyName: user.activeCompanyName ?? "Empresa",
      fromOffice: true,
    };
  }
  const allowedIds = user.allowedCompanyIds?.length
    ? user.allowedCompanyIds
    : user.companyId
      ? [user.companyId]
      : [];
  if (user.activeCompanyId && allowedIds.includes(user.activeCompanyId)) {
    return {
      companyId: user.activeCompanyId,
      companyName: user.activeCompanyName ?? user.companyName ?? "Empresa",
      fromOffice: false,
    };
  }
  if (user.companyId && allowedIds.includes(user.companyId)) {
    return {
      companyId: user.companyId,
      companyName: user.companyName ?? "Empresa",
      fromOffice: false,
    };
  }
  if (allowedIds[0]) {
    const named = user.allowedCompanies?.find((item) => item.id === allowedIds[0]);
    return {
      companyId: allowedIds[0],
      companyName: named?.name ?? user.companyName ?? "Empresa",
      fromOffice: false,
    };
  }
  return null;
}

/** Escreve na empresa: admin dela ou o escritório dentro dela. Consulta nunca. */
export function canWriteCompany(role: AuthUser["role"], scope: CompanyScope): boolean {
  if (scope.fromOffice) return role === "superadmin";
  return role === "admin";
}

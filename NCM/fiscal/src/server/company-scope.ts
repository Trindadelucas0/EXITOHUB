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
  if (!user.companyId) return null;
  return {
    companyId: user.companyId,
    companyName: user.companyName ?? "Empresa",
    fromOffice: false,
  };
}

/** Escreve na empresa: admin dela ou o escritório dentro dela. Consulta nunca. */
export function canWriteCompany(role: AuthUser["role"], scope: CompanyScope): boolean {
  if (scope.fromOffice) return role === "superadmin";
  return role === "admin";
}

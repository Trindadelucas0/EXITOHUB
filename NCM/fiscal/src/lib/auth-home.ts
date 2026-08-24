export type AppRole = "admin" | "consulta" | "superadmin";

/** Sessão nova do escritório nunca tem empresa aberta: cai no painel das empresas. */
export function postLoginPath(role: AppRole | string): string {
  return role === "superadmin" ? "/escritorio/empresas" : "/dashboard";
}

export function homePath(role: AppRole | string, hasActiveCompany: boolean): string {
  if (role !== "superadmin") return "/dashboard";
  return hasActiveCompany ? "/dashboard" : "/escritorio/empresas";
}

export function isOfficePath(pathname: string): boolean {
  return pathname === "/escritorio" || pathname.startsWith("/escritorio/");
}

export function isFiscalPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/" || isOfficePath(pathname)) return false;
  if (pathname.startsWith("/api")) return false;
  return true;
}

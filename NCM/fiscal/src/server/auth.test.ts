import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { homePath, postLoginPath } from "@/src/lib/auth-home";
import { canWriteCompany, resolveCompanyScope } from "./company-scope";
import { loginAllowed, loginFailed, loginSucceeded } from "./rate-limit";
import { HttpError, ownedWhere, requireSuperAdmin } from "./tenant";
import { escapeHtml } from "@/src/lib/html";

describe("senha inválida", () => {
  it("não autentica hash divergente", async () => {
    const hash = await bcrypt.hash("correta", 8);
    const ok = await bcrypt.compare("errada", hash);
    expect(ok).toBe(false);
  });

  it("login por e-mail único abre só a conta cadastrada", () => {
    const users = [
      { email: "admin@baifer.local", companySlug: "baifer" },
      { email: "admin@loja.local", companySlug: "loja" },
    ];
    const pick = (email: string) => users.find((u) => u.email === email) ?? null;
    expect(pick("admin@baifer.local")?.companySlug).toBe("baifer");
    expect(pick("admin@loja.local")?.companySlug).toBe("loja");
    expect(pick("admin@baifer.local")?.companySlug).not.toBe("loja");
  });
});

describe("papéis", () => {
  const office = {
    id: "office",
    companyId: null,
    activeCompanyId: null,
    email: "escritorio@local",
    name: "Escritório",
    role: "superadmin" as const,
    companyName: null,
    activeCompanyName: null,
  };
  const officeInBaifer = {
    ...office,
    activeCompanyId: "cm_baifer_seed_company",
    activeCompanyName: "BAIFER",
  };
  const baiferAdmin = {
    id: "baifer-admin",
    companyId: "cm_baifer_seed_company",
    activeCompanyId: null,
    email: "admin@baifer.local",
    name: "Administrador",
    role: "admin" as const,
    companyName: "BAIFER",
    activeCompanyName: null,
  };
  const baiferConsulta = { ...baiferAdmin, id: "baifer-consulta", role: "consulta" as const };

  it("superadmin cai no painel do escritório; com empresa aberta cai na conferência", () => {
    expect(postLoginPath("superadmin")).toBe("/escritorio/empresas");
    expect(postLoginPath("admin")).toBe("/dashboard");
    expect(postLoginPath("consulta")).toBe("/dashboard");
    expect(homePath("superadmin", false)).toBe("/escritorio/empresas");
    expect(homePath("superadmin", true)).toBe("/dashboard");
  });

  it("admin da empresa não cadastra empresas nem usuários", () => {
    expect(() => requireSuperAdmin(baiferAdmin)).toThrow(HttpError);
    expect(() => requireSuperAdmin(baiferConsulta)).toThrow(HttpError);
    expect(() => requireSuperAdmin(office)).not.toThrow();
  });

  it("escritório sem empresa aberta não tem tenant", () => {
    expect(resolveCompanyScope(office)).toBeNull();
  });

  it("escritório só age na empresa que abriu", () => {
    const scope = resolveCompanyScope(officeInBaifer);
    expect(scope?.companyId).toBe("cm_baifer_seed_company");
    expect(scope?.fromOffice).toBe(true);
    expect(canWriteCompany("superadmin", scope!)).toBe(true);
  });

  it("usuário de empresa fica no tenant dele; consulta não escreve", () => {
    const adminScope = resolveCompanyScope(baiferAdmin);
    const consultaScope = resolveCompanyScope(baiferConsulta);
    expect(adminScope?.companyId).toBe("cm_baifer_seed_company");
    expect(adminScope?.fromOffice).toBe(false);
    expect(canWriteCompany("admin", adminScope!)).toBe(true);
    expect(canWriteCompany("consulta", consultaScope!)).toBe(false);
  });

  it("activeCompanyId de usuário de empresa não muda o tenant", () => {
    const forged = { ...baiferAdmin, activeCompanyId: "cm_loja_seed_company", activeCompanyName: "Loja" };
    expect(resolveCompanyScope(forged)?.companyId).toBe("cm_baifer_seed_company");
  });
});

describe("tenant", () => {
  it("findFirst sempre exige id + companyId", () => {
    const where = ownedWhere("prod-1", "empresa-a");
    expect(where).toEqual({ id: "prod-1", companyId: "empresa-a" });
  });

  it("outro companyId não casa o registro", () => {
    const rows = [
      { id: "prod-1", companyId: "empresa-a" },
      { id: "prod-1", companyId: "empresa-b" },
    ];
    const wanted = ownedWhere("prod-1", "empresa-a");
    const found = rows.find((r) => r.id === wanted.id && r.companyId === wanted.companyId);
    const leaked = rows.find((r) => r.id === "prod-1" && r.companyId === "empresa-b");
    expect(found?.companyId).toBe("empresa-a");
    expect(leaked?.companyId).not.toBe(wanted.companyId);
  });
});

describe("rate limit login", () => {
  beforeEach(() => {
    loginSucceeded("ip-test");
  });

  it("bloqueia após várias falhas", () => {
    for (let i = 0; i < 8; i += 1) loginFailed("ip-test");
    expect(loginAllowed("ip-test")).toBe(false);
  });
});

describe("PDF/HTML escape", () => {
  it("escapa HTML de cadastro", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });
});

describe("IDOR", () => {
  it("outro tenant → 404", async () => {
    const findFirst = vi.fn(async ({ where }: { where: { id: string; companyId: string } }) => {
      if (where.companyId !== "empresa-a") return null;
      return { id: where.id, companyId: where.companyId };
    });
    const own = await findFirst({ where: ownedWhere("abc", "empresa-a") });
    const other = await findFirst({ where: ownedWhere("abc", "empresa-b") });
    expect(own).toBeTruthy();
    expect(other).toBeNull();
  });
});

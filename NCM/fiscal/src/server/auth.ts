import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/src/lib/constants";
import { ncmSessionMatchesHub } from "@/src/lib/ncm-hub-session";
import { prisma, withTenant } from "./db";

export { SESSION_COOKIE };
const SESSION_HOURS = 8;

export type AppRole = "admin" | "consulta" | "superadmin";

export type AllowedCompany = { id: string; name: string };

export type AuthUser = {
  id: string;
  /** Empresa do usuário. Null só no administrador do escritório. */
  companyId: string | null;
  /** Empresa que o escritório abriu nesta sessão. Null fora desse caso. */
  activeCompanyId: string | null;
  email: string;
  name: string;
  role: AppRole;
  companyName: string | null;
  activeCompanyName: string | null;
  allowedCompanyIds?: string[];
  allowedCompanies?: AllowedCompany[];
};

function toAuthUser(
  user: {
    id: string;
    companyId: string | null;
    email: string;
    name: string;
    role: AppRole;
    company: { id?: string; name: string } | null;
  },
  active?: { id: string; name: string } | null,
  allowed?: AllowedCompany[],
): AuthUser {
  const home =
    user.companyId && user.company
      ? { id: user.companyId, name: user.company.name }
      : null;
  const allowedCompanies = allowed && allowed.length ? allowed : home ? [home] : [];
  return {
    id: user.id,
    companyId: user.companyId,
    activeCompanyId: active?.id ?? null,
    email: user.email,
    name: user.name,
    role: user.role,
    companyName: user.company?.name ?? null,
    activeCompanyName: active?.name ?? null,
    allowedCompanyIds: allowedCompanies.map((item) => item.id),
    allowedCompanies,
  };
}

export async function loadAllowedCompanies(
  userId: string,
  home?: AllowedCompany | null,
): Promise<AllowedCompany[]> {
  const rows = await prisma.userCompany.findMany({
    where: { userId },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { company: { name: "asc" } },
  });
  if (rows.length) {
    return rows.map((row) => ({ id: row.company.id, name: row.company.name }));
  }
  return home?.id ? [home] : [];
}

function pickSessionCompany(
  role: AppRole,
  active: { id: string; name: string } | null,
  allowedIds: string[],
): { id: string; name: string } | null {
  if (!active) return null;
  if (role === "superadmin") return active;
  if (allowedIds.includes(active.id)) return active;
  return null;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function authenticate(email: string, password: string): Promise<AuthUser | null> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: normalized },
    include: { company: true },
  });
  if (!user) {
    await bcrypt.hash(password, 10);
    return null;
  }
  if (user.role !== "superadmin" && !user.companyId) {
    await bcrypt.hash(password, 10);
    return null;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  const home = user.companyId && user.company ? { id: user.companyId, name: user.company.name } : null;
  const allowed = await loadAllowedCompanies(user.id, home);
  return toAuthUser(user, null, allowed);
}

export async function createSession(
  user: AuthUser,
  options?: { activeCompanyId?: string | null },
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const data = {
    companyId: user.companyId,
    userId: user.id,
    tokenHash,
    expiresAt,
    activeCompanyId: options?.activeCompanyId ?? null,
  };
  if (!user.companyId) {
    await prisma.session.create({ data });
    return token;
  }
  await withTenant(user.companyId, async (db) => {
    await db.session.create({ data });
  });
  return token;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  const tokenHash = hashSessionToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function getUserFromToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() } },
    include: { user: { include: { company: true } }, activeCompany: true },
  });
  if (!session) return null;
  const home =
    session.user.companyId && session.user.company
      ? { id: session.user.companyId, name: session.user.company.name }
      : null;
  const allowed = await loadAllowedCompanies(session.user.id, home);
  const allowedIds = allowed.map((item) => item.id);
  const requested =
    session.activeCompany
      ? { id: session.activeCompany.id, name: session.activeCompany.name }
      : null;
  const active = pickSessionCompany(session.user.role, requested, allowedIds);
  return toAuthUser(session.user, active, allowed);
}

export async function setActiveCompany(
  token: string | undefined,
  companyId: string | null,
): Promise<number> {
  if (!token) return 0;
  const tokenHash = hashSessionToken(token);
  const result = await prisma.session.updateMany({
    where: { tokenHash, expiresAt: { gt: new Date() } },
    data: { activeCompanyId: companyId },
  });
  return result.count;
}

/**
 * Garante sessão NCM do escritório (cookie fiscal_session) e grava a empresa aberta.
 * No HUB o SSO não carrega activeCompanyId — sem este cookie o dashboard devolve para a lista.
 */
export async function openCompanySession(
  user: AuthUser,
  companyId: string,
): Promise<{ token: string; setCookie: boolean }> {
  const token = await createSession(user, { activeCompanyId: companyId });
  return { token, setCookie: true };
}

export async function readSessionCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await readSessionCookie();
  const fromSession = await getUserFromToken(token);
  if (process.env.HUB_MODE === "1") {
    const { getUserFromHubCookie } = await import("./hub-sso");
    const hubUser = await getUserFromHubCookie();
    if (!hubUser) return null;
    if (fromSession && ncmSessionMatchesHub(fromSession.email, hubUser.email)) {
      return fromSession;
    }
    if (token) await destroySession(token);
    return hubUser;
  }
  return fromSession;
}

export function sessionCookieOptions() {
  const secure =
    process.env.COOKIE_SECURE === "1" ||
    (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "0");
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  };
}

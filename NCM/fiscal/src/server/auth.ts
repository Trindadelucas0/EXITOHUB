import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/src/lib/constants";
import { prisma, withTenant } from "./db";

export { SESSION_COOKIE };
const SESSION_HOURS = 8;

export type AppRole = "admin" | "consulta" | "superadmin";

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
};

function toAuthUser(
  user: {
    id: string;
    companyId: string | null;
    email: string;
    name: string;
    role: AppRole;
    company: { name: string } | null;
  },
  active?: { id: string; name: string } | null,
): AuthUser {
  return {
    id: user.id,
    companyId: user.companyId,
    activeCompanyId: active?.id ?? null,
    email: user.email,
    name: user.name,
    role: user.role,
    companyName: user.company?.name ?? null,
    activeCompanyName: active?.name ?? null,
  };
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
  return toAuthUser(user);
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
  // Só o escritório navega por empresa escolhida; usuário de empresa fica no tenant dele.
  const active =
    session.user.role === "superadmin" && session.activeCompany
      ? { id: session.activeCompany.id, name: session.activeCompany.name }
      : null;
  return toAuthUser(session.user, active);
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
  if (fromSession) return fromSession;
  if (process.env.HUB_MODE === "1") {
    const { getUserFromHubCookie } = await import("./hub-sso");
    return getUserFromHubCookie();
  }
  return null;
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

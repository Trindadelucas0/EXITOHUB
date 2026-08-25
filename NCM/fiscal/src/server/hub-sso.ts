import "server-only";

import { cookies } from "next/headers";
import { Pool } from "pg";
import { prisma } from "./db";
import type { AuthUser } from "./auth";

const HUB_COOKIE = "exito_hub_sid";

let hubPool: Pool | null = null;

function resolveHost(host: string) {
  const value = String(host || "127.0.0.1").trim() || "127.0.0.1";
  if (value === "localhost" || value === "::1") return "127.0.0.1";
  return value;
}

export function getHubPool() {
  if (!hubPool) {
    const host = resolveHost(process.env.HUB_DB_HOST || "127.0.0.1");
    hubPool = new Pool({
      host,
      port: Number(process.env.HUB_DB_PORT || 5432),
      user: process.env.HUB_DB_USER || "postgres",
      password: process.env.HUB_DB_PASSWORD || "",
      database: process.env.HUB_DB_NAME || "exito_hub",
      ...(host === "127.0.0.1" ? { family: 4 } : {}),
    });
  }
  return hubPool;
}

type HubRow = {
  email: string;
  username: string;
  display_name: string | null;
  is_admin: boolean;
  active: boolean;
  has_ncm: boolean;
  has_folha: boolean;
  has_conci: boolean;
};

async function loadHubUser(sessionId: string): Promise<HubRow | null> {
  if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) return null;
  const result = await getHubPool().query(
    `SELECT u.email, u.username, u.display_name, u.is_admin, u.active,
            EXISTS (
              SELECT 1 FROM hub_user_modules m
              WHERE m.user_id = u.id AND m.module = 'ncm'
            ) AS has_ncm,
            EXISTS (
              SELECT 1 FROM hub_user_modules m
              WHERE m.user_id = u.id AND m.module = 'folha'
            ) AS has_folha,
            EXISTS (
              SELECT 1 FROM hub_user_modules m
              WHERE m.user_id = u.id AND m.module = 'conci'
            ) AS has_conci
     FROM hub_sessions s
     JOIN hub_users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()
     LIMIT 1`,
    [sessionId],
  );
  return (result.rows[0] as HubRow | undefined) || null;
}

export type HubModules = {
  folha: boolean;
  conci: boolean;
  ncm: boolean;
  isAdmin: boolean;
};

/** Módulos reais do HUB para a sessão atual (fail-closed: tudo false). */
export async function getHubModulesFromCookie(): Promise<HubModules> {
  const empty: HubModules = { folha: false, conci: false, ncm: false, isAdmin: false };
  if (process.env.HUB_MODE !== "1") {
    return { folha: true, conci: true, ncm: true, isAdmin: false };
  }
  const jar = await cookies();
  const hubSid = jar.get(HUB_COOKIE)?.value;
  if (!hubSid) return empty;
  const hub = await loadHubUser(hubSid);
  if (!hub || !hub.active) return empty;
  return {
    folha: Boolean(hub.has_folha),
    conci: Boolean(hub.has_conci),
    ncm: Boolean(hub.has_ncm),
    isAdmin: Boolean(hub.is_admin),
  };
}

/**
 * Resolve usuário NCM a partir do cookie do EXITO HUB (mesmo e-mail).
 */
export async function getUserFromHubCookie(): Promise<AuthUser | null> {
  if (process.env.HUB_MODE !== "1") return null;
  const jar = await cookies();
  const hubSid = jar.get(HUB_COOKIE)?.value;
  if (!hubSid) return null;

  const hub = await loadHubUser(hubSid);
  if (!hub || !hub.active || !hub.has_ncm) return null;

  const email = String(hub.email || "").trim().toLowerCase();
  if (!email) return null;

  const user = await prisma.user.findFirst({
    where: { email },
    include: { company: true },
  });
  if (!user) return null;
  if (user.role !== "superadmin" && !user.companyId) return null;

  return {
    id: user.id,
    companyId: user.companyId,
    activeCompanyId: null,
    email: user.email,
    name: user.name,
    role: user.role,
    companyName: user.company?.name ?? null,
    activeCompanyName: null,
  };
}

export async function hubHasNcmAccess(): Promise<boolean> {
  if (process.env.HUB_MODE !== "1") return false;
  const jar = await cookies();
  const hubSid = jar.get(HUB_COOKIE)?.value;
  if (!hubSid) return false;
  const hub = await loadHubUser(hubSid);
  return Boolean(hub?.active && hub.has_ncm);
}

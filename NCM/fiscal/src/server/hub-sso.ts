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
};

async function loadHubUser(sessionId: string): Promise<HubRow | null> {
  if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) return null;
  const result = await getHubPool().query(
    `SELECT u.email, u.username, u.display_name, u.is_admin, u.active,
            EXISTS (
              SELECT 1 FROM hub_user_modules m
              WHERE m.user_id = u.id AND m.module = 'ncm'
            ) AS has_ncm
     FROM hub_sessions s
     JOIN hub_users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()
     LIMIT 1`,
    [sessionId],
  );
  return (result.rows[0] as HubRow | undefined) || null;
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

import "server-only";

import { getHubPool } from "./hub-sso";
import { HttpError } from "./tenant";

type UpsertInput = {
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  updatePassword?: boolean;
  landingPath?: string;
};

function normalize(value: string) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Espelha usuário NCM em exito_hub (módulo ncm). Só roda com HUB_MODE=1.
 */
export async function provisionNcmHubUser(input: UpsertInput): Promise<void> {
  if (process.env.HUB_MODE !== "1") return;

  const username = normalize(input.username);
  const email = normalize(input.email);
  const displayName = String(input.displayName || username).trim();
  const passwordHash = String(input.passwordHash || "");
  const updatePassword = input.updatePassword !== false;

  if (!username || !email || !email.includes("@")) {
    throw new HttpError(400, "HUB_PROVISION", "E-mail inválido para o login do HUB.");
  }
  if (!passwordHash) {
    throw new HttpError(400, "HUB_PROVISION", "Senha inválida para o login do HUB.");
  }

  const pool = getHubPool();
  const found = await pool.query(
    `SELECT id, username, email
     FROM hub_users
     WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)`,
    [username, email],
  );

  if (found.rowCount && found.rowCount > 1) {
    throw new HttpError(409, "CONFLICT", "Este usuário e este e-mail pertencem a contas diferentes no HUB.");
  }

  const existing = found.rows[0] as { id: string; username: string; email: string } | undefined;
  if (existing) {
    if (existing.username !== username && existing.email === email) {
      throw new HttpError(409, "CONFLICT", `Este e-mail já existe no HUB (${existing.username}).`);
    }
    if (existing.email !== email && existing.username === username) {
      throw new HttpError(409, "CONFLICT", `Este usuário já existe no HUB com outro e-mail (${existing.email}).`);
    }
  }

  const landingPath = input.landingPath || "/ncm/dashboard";

  let userId: string;
  if (!existing) {
    const inserted = await pool.query(
      `INSERT INTO hub_users (username, email, password_hash, display_name, is_admin, active, landing_path)
       VALUES ($1, $2, $3, $4, false, true, $5)
       RETURNING id`,
      [username, email, passwordHash, displayName, landingPath],
    );
    userId = inserted.rows[0].id as string;
  } else {
    userId = existing.id;
    if (updatePassword) {
      await pool.query("UPDATE hub_users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
    }
    await pool.query(
      `UPDATE hub_users SET landing_path = $1 WHERE id = $2 AND (landing_path IS NULL OR landing_path = '')`,
      [landingPath, userId],
    );
  }

  await pool.query(
    `INSERT INTO hub_user_modules (user_id, module) VALUES ($1, 'ncm') ON CONFLICT DO NOTHING`,
    [userId],
  );
}

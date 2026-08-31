"use strict";

const bcrypt = require("bcryptjs");
const { query, MODULES } = require("./db");

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function conciHubEmail(username) {
  const user = normalizeUsername(username);
  if (!user) return "";
  return user.includes("@") ? user : `${user}@conci.hub`;
}

async function findHubIdentities(username, email) {
  const result = await query(
    `SELECT id, username, email, display_name, is_admin, active
     FROM hub_users
     WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)`,
    [username, email],
  );
  return result.rows;
}

/**
 * Cria ou atualiza usuário do HUB a partir de um módulo (NCM/Conci/Folha).
 * Nunca promove a admin do HUB. Senha só é alterada quando password ou
 * updatePassword+passwordHash vierem de um cadastro novo.
 */
async function setHubUserModulesExact(userId, modules) {
  const allowed = (modules || []).filter((m) => MODULES.includes(m));
  await query("DELETE FROM hub_user_modules WHERE user_id = $1", [userId]);
  for (const mod of allowed) {
    await query(
      `INSERT INTO hub_user_modules (user_id, module) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, mod],
    );
  }
  return allowed;
}

async function upsertHubUser({
  username,
  email,
  password,
  passwordHash,
  displayName,
  modules,
  modulesExact = false,
  updatePassword = true,
  landingPath,
}) {
  const user = normalizeUsername(username);
  const mail = normalizeEmail(email);
  if (!user) throw new Error("Usuário do HUB é obrigatório.");
  if (!mail || !mail.includes("@")) throw new Error("E-mail do HUB é obrigatório.");

  const allowed = (modules || []).filter((m) => MODULES.includes(m));
  if (!allowed.length) throw new Error("Informe ao menos um módulo (folha, conci ou ncm).");

  const rows = await findHubIdentities(user, mail);
  if (rows.length > 1) {
    throw new Error("Este usuário e este e-mail pertencem a contas diferentes no HUB.");
  }

  const existing = rows[0] || null;
  if (existing) {
    if (existing.username !== user && existing.email === mail) {
      throw new Error(`Este e-mail já existe no HUB (${existing.username}).`);
    }
    if (existing.email !== mail && existing.username === user) {
      throw new Error(`Este usuário já existe no HUB com outro e-mail (${existing.email}).`);
    }
  }

  let hash = null;
  if (password) {
    hash = await bcrypt.hash(String(password), 12);
  } else if (passwordHash && (updatePassword || !existing)) {
    hash = String(passwordHash);
  }

  if (!existing && !hash) {
    throw new Error("Senha é obrigatória para criar o login do HUB.");
  }

  let userId;
  const landing = String(landingPath || "").trim() || null;
  if (!existing) {
    const inserted = await query(
      `INSERT INTO hub_users (username, email, password_hash, display_name, is_admin, active, landing_path)
       VALUES ($1, $2, $3, $4, false, true, $5)
       RETURNING id`,
      [user, mail, hash, String(displayName || user).trim(), landing],
    );
    userId = inserted.rows[0].id;
  } else {
    userId = existing.id;
    if (hash && updatePassword) {
      await query("UPDATE hub_users SET password_hash = $1 WHERE id = $2", [hash, userId]);
    }
    if (displayName) {
      await query(
        `UPDATE hub_users SET display_name = $1 WHERE id = $2 AND (display_name IS NULL OR display_name = username)`,
        [String(displayName).trim(), userId],
      );
    }
    if (landing) {
      await query(
        `UPDATE hub_users SET landing_path = $1 WHERE id = $2 AND (landing_path IS NULL OR landing_path = '')`,
        [landing, userId],
      );
    }
  }

  if (modulesExact) {
    await setHubUserModulesExact(userId, allowed);
  } else {
    for (const mod of allowed) {
      await query(
        `INSERT INTO hub_user_modules (user_id, module) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, mod],
      );
    }
  }

  return { id: userId, username: user, email: mail, created: !existing };
}

module.exports = {
  upsertHubUser,
  setHubUserModulesExact,
  findHubIdentities,
  conciHubEmail,
  normalizeUsername,
  normalizeEmail,
};

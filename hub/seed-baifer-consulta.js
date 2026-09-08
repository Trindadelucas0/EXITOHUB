"use strict";

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "NCM", "fiscal", ".env") });

const { query, closePool } = require("./db");

async function seedBaiferConsulta() {
  const username = String(process.env.HUB_SEED_BAIFER_CONSULTA_USER || "consulta.baifer")
    .trim()
    .toLowerCase();
  const email = String(
    process.env.HUB_SEED_BAIFER_CONSULTA_EMAIL || "consulta@baifer.local",
  )
    .trim()
    .toLowerCase();
  const password = String(
    process.env.HUB_SEED_BAIFER_CONSULTA_PASSWORD || process.env.SEED_ADMIN_PASSWORD || "",
  ).trim();
  const displayName = String(process.env.HUB_SEED_BAIFER_CONSULTA_NAME || "Consulta BAIFER").trim();

  if (!username || !email || !email.includes("@")) {
    console.warn("[hub] seed consulta BAIFER ignorado — usuário/e-mail inválido");
    return { created: false };
  }

  const { listNcmCompanies } = require("./provision-modules");
  const companies = await listNcmCompanies();
  const baifer = companies.find((c) => c.slug === "baifer");
  if (!baifer) {
    console.warn("[hub] seed consulta BAIFER ignorado — empresa baifer não encontrada no NCM");
    return { created: false };
  }

  const { createUser, updateUserWithModules } = require("./auth");
  const moduleMeta = { ncm: { role: "consulta", companyId: baifer.id } };

  const byEmail = await query(
    `SELECT id, username, email FROM hub_users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
  );
  const byUsername = await query(
    `SELECT id, username, email FROM hub_users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [username],
  );

  let user = byEmail.rows[0] || null;
  if (!user && byUsername.rowCount) {
    const taken = byUsername.rows[0];
    if (String(taken.email).toLowerCase() !== email) {
      console.warn(
        `[hub] seed consulta BAIFER ignorado — usuário ${username} já existe com outro e-mail`,
      );
      return { created: false };
    }
    user = taken;
  }

  if (!user) {
    if (!password) {
      console.warn(
        "[hub] seed consulta BAIFER ignorado — defina HUB_SEED_BAIFER_CONSULTA_PASSWORD ou SEED_ADMIN_PASSWORD",
      );
      return { created: false };
    }
    await createUser({
      username,
      email,
      password,
      displayName,
      isAdmin: false,
      modules: ["ncm"],
      moduleMeta,
    });
    console.log(`[hub] consulta BAIFER criado: ${username}`);
    return { created: true };
  }

  if (String(user.username).toLowerCase() !== username) {
    const clash = await query(
      "SELECT id, email FROM hub_users WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1",
      [username, user.id],
    );
    if (!clash.rowCount) {
      await query("UPDATE hub_users SET username = $1 WHERE id = $2", [username, user.id]);
    } else {
      console.warn(
        `[hub] usuário ${username} já existe (${clash.rows[0].email}); NCM consulta permanece ${user.email}`,
      );
    }
  }

  await updateUserWithModules(user.id, {
    modules: ["ncm"],
    moduleMeta,
    isAdmin: false,
    active: true,
  });
  await query(
    `UPDATE hub_users
     SET display_name = $1, is_admin = false, active = true, landing_path = '/ncm/dashboard'
     WHERE id = $2`,
    [displayName, user.id],
  );
  console.log(`[hub] consulta BAIFER alinhado: ${email} → /ncm/dashboard`);
  return { created: false, updated: true };
}

async function main() {
  try {
    await seedBaiferConsulta();
  } catch (err) {
    console.error("[hub] seed consulta BAIFER falhou:", err.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedBaiferConsulta };

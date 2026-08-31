"use strict";

/**
 * Reconcilia módulos do HUB com a origem nos bancos Conci/NCM.
 * Remove folha/ncm/conci fantasmas de contas de módulo único.
 *
 * Uso:
 *   node hub/reconcile-hub-modules.js --dry-run
 *   node hub/reconcile-hub-modules.js
 */

const { Client } = require("pg");
const { query } = require("./db");
const { conciHubEmail } = require("./provision");
const { hubConfig, ncmConfig, conciConfig } = require("./db-clients");
const { landingPathForModules } = require("./auth");

const dryRun = process.argv.includes("--dry-run");

function log(msg) {
  console.log(`  ${dryRun ? "DRY" : "FIX"}  ${msg}`);
}

async function loadHubModules(hub, userId) {
  const r = await hub.query(
    "SELECT module FROM hub_user_modules WHERE user_id = $1 ORDER BY module",
    [userId],
  );
  return r.rows.map((row) => row.module);
}

async function setModulesExact(hub, userId, modules, landingPath) {
  if (dryRun) return;
  await hub.query("DELETE FROM hub_user_modules WHERE user_id = $1", [userId]);
  for (const mod of modules) {
    await hub.query(
      "INSERT INTO hub_user_modules (user_id, module) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, mod],
    );
  }
  if (landingPath !== undefined) {
    await hub.query("UPDATE hub_users SET landing_path = $1 WHERE id = $2", [landingPath, userId]);
  }
}

async function findHubByUsername(hub, username) {
  const r = await hub.query(
    `SELECT id, username, email, is_admin, active
     FROM hub_users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [username],
  );
  return r.rows[0] || null;
}

async function findHubByEmail(hub, email) {
  const r = await hub.query(
    `SELECT id, username, email, is_admin, active
     FROM hub_users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
  );
  return r.rows[0] || null;
}

async function reconcileConci(hub, conci) {
  let fixed = 0;
  const rows = await conci.query(
    "SELECT username, role FROM users WHERE ativo = true",
  );
  for (const row of rows.rows) {
    const username = String(row.username || "").trim().toLowerCase();
    if (!username) continue;
    const hubUser = await findHubByUsername(hub, username);
    if (!hubUser || !hubUser.active) {
      log(`Conci ${username}: sem usuário ativo no HUB (ignorado)`);
      continue;
    }
    if (hubUser.is_admin) {
      log(`Conci ${username}: admin HUB — módulos preservados`);
      continue;
    }
    const mods = await loadHubModules(hub, hubUser.id);
    const expected = ["conci"];
    const meta = { conci: { role: row.role } };
    const landing = landingPathForModules(expected, meta);
    const extras = mods.filter((m) => !expected.includes(m));
    if (extras.length || mods.length !== 1 || mods[0] !== "conci") {
      log(`Conci ${username}: módulos ${mods.join(",") || "(vazio)"} → conci`);
      await setModulesExact(hub, hubUser.id, expected, landing);
      fixed += 1;
    }
  }
  return fixed;
}

async function reconcileNcm(hub, ncm) {
  let fixed = 0;
  const rows = await ncm.query(
    "SELECT email, role, company_id FROM users WHERE email IS NOT NULL",
  );
  for (const row of rows.rows) {
    const email = String(row.email || "").trim().toLowerCase();
    if (!email) continue;
    const hubUser = await findHubByEmail(hub, email);
    if (!hubUser || !hubUser.active) {
      log(`NCM ${email}: sem usuário ativo no HUB (ignorado)`);
      continue;
    }
    if (hubUser.is_admin) {
      log(`NCM ${email}: admin HUB — módulos preservados`);
      continue;
    }
    if (row.role === "superadmin") {
      log(`NCM ${email}: superadmin — módulos preservados`);
      continue;
    }
    if (!row.company_id) continue;
    const mods = await loadHubModules(hub, hubUser.id);
    const expected = ["ncm"];
    const meta = { ncm: { role: row.role, companyId: row.company_id } };
    const landing = landingPathForModules(expected, meta);
    const extras = mods.filter((m) => !expected.includes(m));
    if (extras.length || mods.length !== 1 || mods[0] !== "ncm") {
      log(`NCM ${email}: módulos ${mods.join(",") || "(vazio)"} → ncm`);
      await setModulesExact(hub, hubUser.id, expected, landing);
      fixed += 1;
    }
  }
  return fixed;
}

async function main() {
  await query("SELECT 1");
  const hub = new Client(hubConfig());
  const ncm = new Client(ncmConfig());
  const conci = new Client(conciConfig());
  await hub.connect();
  await ncm.connect();
  await conci.connect();

  console.log(`[reconcile] ${dryRun ? "simulação" : "aplicando"} correções\n`);
  const conciFixed = await reconcileConci(hub, conci);
  const ncmFixed = await reconcileNcm(hub, ncm);

  await hub.end();
  await ncm.end();
  await conci.end();

  console.log("");
  console.log(`[reconcile] Conci: ${conciFixed} conta(s); NCM: ${ncmFixed} conta(s)`);
  if (dryRun) {
    console.log("[reconcile] Rode sem --dry-run para aplicar.");
  } else {
    console.log("[reconcile] ok");
  }
}

main().catch((err) => {
  console.error("[reconcile] erro:", err.message);
  process.exit(1);
});

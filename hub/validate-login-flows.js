"use strict";

/**
 * Valida no banco se os personas de login único estão coerentes
 * (módulos + landing + vínculo de empresa). Não libera permissão.
 *
 * Uso: node hub/validate-login-flows.js
 */

const path = require("path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

function resolveHost(host) {
  const value = String(host || "127.0.0.1").trim() || "127.0.0.1";
  if (value === "localhost" || value === "::1") return "127.0.0.1";
  return value;
}

function hubConfig() {
  const host = resolveHost(process.env.HUB_DB_HOST);
  const config = {
    host,
    port: Number(process.env.HUB_DB_PORT || 5432),
    user: process.env.HUB_DB_USER || "postgres",
    password: process.env.HUB_DB_PASSWORD || "",
    database: process.env.HUB_DB_NAME || "exito_hub",
  };
  if (host === "127.0.0.1") config.family = 4;
  return config;
}

function ncmConfig() {
  if (process.env.NCM_DATABASE_URL) {
    return { connectionString: process.env.NCM_DATABASE_URL };
  }
  const host = resolveHost(process.env.NCM_DB_HOST || process.env.HUB_DB_HOST);
  const config = {
    host,
    port: Number(process.env.NCM_DB_PORT || process.env.HUB_DB_PORT || 5432),
    user: process.env.NCM_DB_USER || process.env.HUB_DB_USER || "postgres",
    password: process.env.NCM_DB_PASSWORD || process.env.HUB_DB_PASSWORD || "",
    database: process.env.NCM_DB_NAME || "fiscal-p",
  };
  if (host === "127.0.0.1") config.family = 4;
  return config;
}

function conciConfig() {
  const host = resolveHost(process.env.CONCI_DB_HOST || process.env.HUB_DB_HOST);
  const config = {
    host,
    port: Number(process.env.CONCI_DB_PORT || process.env.HUB_DB_PORT || 5432),
    user: process.env.CONCI_DB_USER || process.env.HUB_DB_USER || "postgres",
    password: process.env.CONCI_DB_PASSWORD || process.env.HUB_DB_PASSWORD || "",
    database: process.env.CONCI_DB_NAME || "CONCI",
  };
  if (host === "127.0.0.1") config.family = 4;
  return config;
}

function ok(msg) {
  console.log(`  OK  ${msg}`);
}

function fail(msg) {
  console.error(`  FAIL ${msg}`);
}

async function main() {
  const errors = [];
  const hub = new Client(hubConfig());
  const ncm = new Client(ncmConfig());
  const conci = new Client(conciConfig());

  await hub.connect();
  await ncm.connect();
  await conci.connect();

  console.log("[validate] personas de login HUB\n");

  // 1) HUB só Folha
  {
    const r = await hub.query(
      `SELECT u.username, u.landing_path,
              ARRAY_AGG(m.module ORDER BY m.module) AS modules
       FROM hub_users u
       JOIN hub_user_modules m ON m.user_id = u.id
       WHERE u.active = true
       GROUP BY u.id
       HAVING COUNT(*) = 1 AND BOOL_OR(m.module = 'folha')`,
    );
    if (!r.rowCount) {
      console.log("  —  nenhum usuário só Folha (ok se ainda não criou)");
    } else {
      for (const row of r.rows) {
        const landing = String(row.landing_path || "");
        if (landing === "/folha/modulos" || landing === "") {
          ok(`Folha ${row.username} → landing ${landing || "(fallback módulo)"}`);
        } else {
          fail(`Folha ${row.username} landing inesperado: ${landing}`);
          errors.push(`folha:${row.username}`);
        }
      }
    }
  }

  // 2) NCM empresa: hub só ncm + companyId no fiscal-p + landing dashboard
  {
    const r = await hub.query(
      `SELECT u.username, u.email, u.landing_path,
              ARRAY_AGG(m.module ORDER BY m.module) AS modules
       FROM hub_users u
       JOIN hub_user_modules m ON m.user_id = u.id
       WHERE u.active = true AND u.is_admin = false
       GROUP BY u.id
       HAVING COUNT(*) = 1 AND BOOL_OR(m.module = 'ncm')`,
    );
    for (const row of r.rows) {
      const mods = row.modules || [];
      if (mods.includes("folha") || mods.includes("conci")) {
        fail(`NCM ${row.email} tem módulos extras: ${mods.join(",")}`);
        errors.push(`ncm-modules:${row.email}`);
        continue;
      }
      const ncmUser = await ncm.query(
        `SELECT id, company_id, role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [row.email],
      );
      if (!ncmUser.rowCount) {
        fail(`NCM ${row.email} no HUB sem user em fiscal-p`);
        errors.push(`ncm-missing:${row.email}`);
        continue;
      }
      const nu = ncmUser.rows[0];
      if (nu.role === "superadmin") {
        ok(`NCM escritório ${row.email} (superadmin)`);
        continue;
      }
      if (!nu.company_id) {
        fail(`NCM ${row.email} sem company_id`);
        errors.push(`ncm-tenant:${row.email}`);
        continue;
      }
      const landing = String(row.landing_path || "");
      if (landing === "/ncm/dashboard" || landing === "/ncm/" || landing === "") {
        ok(`NCM empresa ${row.email} → company ${nu.company_id} landing ${landing || "(fallback)"}`);
      } else if (landing === "/ncm/escritorio/empresas") {
        fail(`NCM empresa ${row.email} com landing de escritório`);
        errors.push(`ncm-landing:${row.email}`);
      } else {
        fail(`NCM ${row.email} landing inesperado: ${landing}`);
        errors.push(`ncm-landing:${row.email}`);
      }
    }
  }

  // 3) Conci empresa: hub só conci + empresa_id
  {
    const r = await hub.query(
      `SELECT u.username, u.landing_path,
              ARRAY_AGG(m.module ORDER BY m.module) AS modules
       FROM hub_users u
       JOIN hub_user_modules m ON m.user_id = u.id
       WHERE u.active = true AND u.is_admin = false
       GROUP BY u.id
       HAVING COUNT(*) = 1 AND BOOL_OR(m.module = 'conci')`,
    );
    for (const row of r.rows) {
      const conciUser = await conci.query(
        `SELECT id, role, empresa_id, ativo FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
        [row.username],
      );
      if (!conciUser.rowCount) {
        fail(`Conci ${row.username} no HUB sem user em CONCI`);
        errors.push(`conci-missing:${row.username}`);
        continue;
      }
      const cu = conciUser.rows[0];
      if (cu.role === "admin") {
        ok(`Conci admin ${row.username}`);
        continue;
      }
      if (!cu.empresa_id) {
        fail(`Conci ${row.username} role empresa sem empresa_id`);
        errors.push(`conci-tenant:${row.username}`);
        continue;
      }
      const landing = String(row.landing_path || "");
      if (landing === "/conci/" || landing === "") {
        ok(`Conci empresa ${row.username} → empresa ${cu.empresa_id}`);
      } else {
        fail(`Conci ${row.username} landing inesperado: ${landing}`);
        errors.push(`conci-landing:${row.username}`);
      }
    }
  }

  // 4) Nenhum usuário “só NCM” (empresa) com Folha/Conci no HUB
  {
    const r = await hub.query(
      `SELECT u.email, ARRAY_AGG(m.module ORDER BY m.module) AS modules
       FROM hub_users u
       JOIN hub_user_modules m ON m.user_id = u.id
       WHERE u.active = true AND u.is_admin = false
       GROUP BY u.id
       HAVING BOOL_OR(m.module = 'ncm')
          AND (BOOL_OR(m.module = 'folha') OR BOOL_OR(m.module = 'conci'))`,
    );
    // Filtra quem também é empresa no NCM (não superadmin)
    for (const row of r.rows) {
      const ncmUser = await ncm.query(
        `SELECT role, company_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [row.email],
      );
      if (!ncmUser.rowCount) continue;
      if (ncmUser.rows[0].role !== "superadmin" && ncmUser.rows[0].company_id) {
        fail(
          `Empresa NCM ${row.email} com módulos extras no HUB: ${(row.modules || []).join(",")}`,
        );
        errors.push(`ncm-overpermitted:${row.email}`);
      }
    }
    if (!errors.some((e) => e.startsWith("ncm-overpermitted:"))) {
      ok("nenhuma empresa NCM com Folha/Conci liberados no HUB");
    }
  }

  // 5) Admin Conci: só conci + landing admin
  {
    const admins = await conci.query(
      `SELECT username FROM users WHERE role = 'admin' AND ativo = true`,
    );
    for (const row of admins.rows) {
      const hubUser = await hub.query(
        `SELECT u.id, u.username, u.landing_path, u.is_admin,
                ARRAY_AGG(m.module ORDER BY m.module) AS modules
         FROM hub_users u
         LEFT JOIN hub_user_modules m ON m.user_id = u.id
         WHERE LOWER(u.username) = LOWER($1) AND u.active = true
         GROUP BY u.id`,
        [row.username],
      );
      if (!hubUser.rowCount) {
        fail(`Conci admin ${row.username} sem usuário no HUB`);
        errors.push(`conci-admin-missing:${row.username}`);
        continue;
      }
      const hu = hubUser.rows[0];
      const mods = (hu.modules || []).filter(Boolean);
      if (hu.is_admin) {
        ok(`Conci admin ${row.username} também é admin HUB (${mods.join(",") || "sem módulos"})`);
        continue;
      }
      if (mods.length !== 1 || mods[0] !== "conci") {
        fail(`Conci admin ${row.username} com módulos extras: ${mods.join(",") || "(vazio)"}`);
        errors.push(`conci-admin-modules:${row.username}`);
        continue;
      }
      const landing = String(hu.landing_path || "");
      if (landing === "/conci/admin/empresas" || landing === "") {
        ok(`Conci admin ${row.username} → landing ${landing || "(fallback)"}`);
      } else {
        fail(`Conci admin ${row.username} landing inesperado: ${landing}`);
        errors.push(`conci-admin-landing:${row.username}`);
      }
    }
  }

  await hub.end();
  await ncm.end();
  await conci.end();

  console.log("");
  if (errors.length) {
    console.error(`[validate] ${errors.length} problema(s).`);
    process.exit(1);
  }
  console.log("[validate] ok");
}

main().catch((err) => {
  console.error("[validate] erro:", err.message);
  process.exit(1);
});

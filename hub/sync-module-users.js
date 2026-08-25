"use strict";

const { Client } = require("pg");
const { upsertHubUser, conciHubEmail } = require("./provision");

function resolveHost(host) {
  const value = String(host || "127.0.0.1").trim() || "127.0.0.1";
  if (value === "localhost" || value === "::1") return "127.0.0.1";
  return value;
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

async function syncNcmUsers() {
  const client = new Client(ncmConfig());
  await client.connect();
  try {
    const result = await client.query(
      `SELECT email, name, password_hash, role FROM users WHERE email IS NOT NULL AND password_hash IS NOT NULL`,
    );
    let created = 0;
    let skipped = 0;
    for (const row of result.rows) {
      const email = String(row.email || "").trim().toLowerCase();
      if (!email) continue;
      try {
        const out = await upsertHubUser({
          username: email,
          email,
          passwordHash: row.password_hash,
          displayName: row.name,
          modules: ["ncm"],
          updatePassword: false,
          landingPath: row.role === "superadmin" ? "/ncm/escritorio/empresas" : "/ncm/dashboard",
        });
        if (out.created) created += 1;
      } catch (err) {
        skipped += 1;
        console.warn(`[hub] sync NCM ${email}: ${err.message}`);
      }
    }
    if (result.rowCount) {
      console.log(`[hub] sync NCM: ${result.rowCount} lidos, ${created} novos, ${skipped} ignorados`);
    }
  } finally {
    await client.end();
  }
}

async function syncConciUsers() {
  const client = new Client(conciConfig());
  await client.connect();
  try {
    const result = await client.query(
      `SELECT username, password_hash, role FROM users WHERE ativo = true AND password_hash IS NOT NULL`,
    );
    let created = 0;
    let skipped = 0;
    for (const row of result.rows) {
      const username = String(row.username || "").trim().toLowerCase();
      if (!username) continue;
      try {
        const out = await upsertHubUser({
          username,
          email: conciHubEmail(username),
          passwordHash: row.password_hash,
          displayName: username,
          modules: ["conci"],
          updatePassword: false,
          landingPath: row.role === "admin" ? "/conci/admin/empresas" : "/conci/",
        });
        if (out.created) created += 1;
      } catch (err) {
        skipped += 1;
        console.warn(`[hub] sync Conci ${username}: ${err.message}`);
      }
    }
    if (result.rowCount) {
      console.log(`[hub] sync Conci: ${result.rowCount} lidos, ${created} novos, ${skipped} ignorados`);
    }
  } finally {
    await client.end();
  }
}

async function syncModuleUsers() {
  try {
    await syncNcmUsers();
  } catch (err) {
    console.warn("[hub] sync NCM ignorado:", err.message);
  }
  try {
    await syncConciUsers();
  } catch (err) {
    console.warn("[hub] sync Conci ignorado:", err.message);
  }
}

module.exports = { syncModuleUsers, syncNcmUsers, syncConciUsers };

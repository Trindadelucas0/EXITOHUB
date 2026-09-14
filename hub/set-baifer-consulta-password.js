"use strict";

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "NCM", "fiscal", ".env") });

const { query, closePool } = require("./db");

async function main() {
  const email = String(
    process.env.HUB_SEED_BAIFER_CONSULTA_EMAIL || "consulta@baifer.local",
  )
    .trim()
    .toLowerCase();
  const password = String(process.env.HUB_SEED_BAIFER_CONSULTA_PASSWORD || "").trim();
  if (!password) {
    console.error("[hub] defina HUB_SEED_BAIFER_CONSULTA_PASSWORD");
    process.exitCode = 1;
    return;
  }

  const { listNcmCompanies } = require("./provision-modules");
  const companies = await listNcmCompanies();
  const baifer = companies.find((c) => c.slug === "baifer");
  if (!baifer) {
    throw new Error("empresa baifer não encontrada");
  }

  const existing = await query(
    `SELECT id, username, email FROM hub_users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
  );
  if (!existing.rowCount) {
    throw new Error(`usuário ${email} não encontrado no HUB`);
  }

  const { updateUserWithModules } = require("./auth");
  await updateUserWithModules(existing.rows[0].id, {
    modules: ["ncm"],
    moduleMeta: { ncm: { role: "consulta", companyId: baifer.id } },
    password,
    isAdmin: false,
    active: true,
  });
  await query(
    `UPDATE hub_users SET landing_path = '/ncm/dashboard' WHERE id = $1`,
    [existing.rows[0].id],
  );
  console.log(`[hub] senha da consulta BAIFER atualizada (${email})`);
}

main()
  .catch((err) => {
    console.error("[hub] falha ao atualizar senha:", err.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());

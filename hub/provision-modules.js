"use strict";

const bcrypt = require("bcryptjs");
const { Client } = require("pg");
const { conciHubEmail, normalizeUsername, normalizeEmail } = require("./provision");
const { ncmConfig, conciConfig } = require("./db-clients");

async function withClient(config, fn) {
  const client = new Client(config);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function asIdList(value) {
  if (value == null || value === "") return [];
  const raw = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const id = String(item || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function listConciEmpresas() {
  return withClient(conciConfig(), async (client) => {
    const result = await client.query(
      `SELECT id, nome, ativo FROM empresas ORDER BY nome ASC`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      ativo: row.ativo !== false,
    }));
  });
}

async function listNcmCompanies() {
  return withClient(ncmConfig(), async (client) => {
    const result = await client.query(
      `SELECT id, name, slug FROM companies ORDER BY name ASC`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
    }));
  });
}

function masterModuleMeta() {
  return {
    conci: { role: "admin", empresaId: null, empresaIds: [] },
    ncm: { role: "superadmin", companyId: null, companyIds: [] },
  };
}

function isMasterFlag(body) {
  const raw = body && body.is_master;
  const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  return value === "1" || value === "on" || value === true;
}

function parseModuleMeta(body) {
  if (isMasterFlag(body)) return masterModuleMeta();
  const conciRole = String(body.conci_role || "empresa").trim();
  const ncmRole = String(body.ncm_role || "consulta").trim();
  const conciEmpresaIds = asIdList(body.conci_empresa_ids).length
    ? asIdList(body.conci_empresa_ids)
    : asIdList(body.conci_empresa_id);
  const ncmCompanyIds = asIdList(body.ncm_company_ids).length
    ? asIdList(body.ncm_company_ids)
    : asIdList(body.ncm_company_id);
  if (ncmRole === "superadmin") {
    return {
      conci: {
        role: conciRole === "admin" ? "admin" : "empresa",
        empresaId: conciEmpresaIds[0] || null,
        empresaIds: conciEmpresaIds,
      },
      ncm: { role: "superadmin", companyId: null, companyIds: [] },
    };
  }
  return {
    conci: {
      role: conciRole === "admin" ? "admin" : "empresa",
      empresaId: conciEmpresaIds[0] || null,
      empresaIds: conciEmpresaIds,
    },
    ncm: {
      role: ncmRole === "admin" ? "admin" : "consulta",
      companyId: ncmCompanyIds[0] || null,
      companyIds: ncmCompanyIds,
    },
  };
}

function validateModuleMeta(modules, moduleMeta) {
  const allowed = Array.isArray(modules) ? modules : [];
  if (allowed.includes("conci")) {
    if (!moduleMeta?.conci?.role) {
      throw new Error("Informe o papel na Conciliação (admin ou empresa).");
    }
    if (moduleMeta.conci.role === "empresa") {
      const ids = asIdList(moduleMeta.conci.empresaIds || moduleMeta.conci.empresaId);
      if (!ids.length) {
        throw new Error("Usuário Conciliação (empresa) precisa de pelo menos uma empresa vinculada.");
      }
    }
  }
  if (allowed.includes("ncm")) {
    if (!moduleMeta?.ncm?.role) {
      throw new Error("Informe o papel no NCM (admin ou consulta).");
    }
    const ids = asIdList(moduleMeta.ncm.companyIds || moduleMeta.ncm.companyId);
    if (moduleMeta.ncm.role !== "superadmin" && !ids.length) {
      throw new Error("Usuário NCM precisa de pelo menos uma empresa vinculada.");
    }
  }
}

async function ensureConciUserEmpresas(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_empresas (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, empresa_id)
    )
  `);
  await client.query(`
    INSERT INTO user_empresas (user_id, empresa_id)
    SELECT id, empresa_id FROM users
    WHERE role = 'empresa' AND empresa_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
}

async function ensureNcmUserCompanies(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_companies (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, company_id)
    )
  `);
  await client.query(`
    INSERT INTO user_companies (user_id, company_id)
    SELECT id, company_id FROM users
    WHERE company_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `);
}

async function replaceConciEmpresas(client, userId, empresaIds) {
  await client.query("DELETE FROM user_empresas WHERE user_id = $1", [userId]);
  for (const empresaId of empresaIds) {
    await client.query(
      `INSERT INTO user_empresas (user_id, empresa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, empresaId],
    );
  }
}

async function replaceNcmCompanies(client, userId, companyIds) {
  await client.query("DELETE FROM user_companies WHERE user_id = $1", [userId]);
  for (const companyId of companyIds) {
    await client.query(
      `INSERT INTO user_companies (user_id, company_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, companyId],
    );
  }
}

async function loadUserModuleMeta(hubUser) {
  const meta = {
    conci: { role: "empresa", empresaId: null, empresaIds: [] },
    ncm: { role: "consulta", companyId: null, companyIds: [] },
  };
  if (!hubUser) return meta;

  if (hubUser.canConci) {
    await withClient(conciConfig(), async (client) => {
      await ensureConciUserEmpresas(client);
      const result = await client.query(
        `SELECT id, role, empresa_id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
        [hubUser.username],
      );
      if (!result.rowCount) return;
      meta.conci.role = result.rows[0].role;
      meta.conci.empresaId = result.rows[0].empresa_id || null;
      const links = await client.query(
        `SELECT empresa_id FROM user_empresas WHERE user_id = $1`,
        [result.rows[0].id],
      );
      meta.conci.empresaIds = links.rows.map((row) => row.empresa_id);
      if (!meta.conci.empresaIds.length && meta.conci.empresaId) {
        meta.conci.empresaIds = [meta.conci.empresaId];
      }
    });
  }

  if (hubUser.canNcm) {
    await withClient(ncmConfig(), async (client) => {
      await ensureNcmUserCompanies(client);
      const result = await client.query(
        `SELECT id, role, company_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [hubUser.email],
      );
      if (!result.rowCount) return;
      meta.ncm.role = result.rows[0].role;
      meta.ncm.companyId = result.rows[0].company_id || null;
      const links = await client.query(
        `SELECT company_id FROM user_companies WHERE user_id = $1`,
        [result.rows[0].id],
      );
      meta.ncm.companyIds = links.rows.map((row) => row.company_id);
      if (!meta.ncm.companyIds.length && meta.ncm.companyId) {
        meta.ncm.companyIds = [meta.ncm.companyId];
      }
    });
  }

  return meta;
}

async function loadUsersModuleMeta(users) {
  const map = new Map();
  for (const user of users || []) {
    map.set(user.id, await loadUserModuleMeta(user));
  }
  return map;
}

async function provisionConciUser({
  username,
  password,
  passwordHash,
  displayName,
  role = "empresa",
  empresaId = null,
  empresaIds = null,
  updatePassword = true,
}) {
  const user = normalizeUsername(username);
  if (!user) throw new Error("Usuário Conciliação é obrigatório.");
  const ids = role === "empresa"
    ? asIdList(empresaIds && empresaIds.length ? empresaIds : empresaId)
    : [];
  if (role === "empresa" && !ids.length) {
    throw new Error("Empresa Conciliação é obrigatória para papel empresa.");
  }
  const primaryId = ids[0] || null;

  let hash = passwordHash ? String(passwordHash) : null;
  if (!hash && password) {
    hash = await bcrypt.hash(String(password), 10);
  }

  await withClient(conciConfig(), async (client) => {
    await ensureConciUserEmpresas(client);
    for (const id of ids) {
      const empresa = await client.query(
        "SELECT id, ativo FROM empresas WHERE id = $1 LIMIT 1",
        [id],
      );
      if (!empresa.rowCount) throw new Error("Empresa Conciliação não encontrada.");
      if (empresa.rows[0].ativo === false) throw new Error("Empresa Conciliação está inativa.");
    }

    const existing = await client.query(
      "SELECT id, password_hash FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [user],
    );

    let userId;
    if (!existing.rowCount) {
      if (!hash) throw new Error("Senha é obrigatória para provisionar Conciliação.");
      const inserted = await client.query(
        `INSERT INTO users (username, password_hash, role, empresa_id, ativo)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id`,
        [user, hash, role, primaryId],
      );
      userId = inserted.rows[0].id;
    } else {
      userId = existing.rows[0].id;
      const sets = ["role = $1", "empresa_id = $2", "ativo = true"];
      const params = [role, primaryId];
      if (hash && updatePassword) {
        params.push(hash);
        sets.push(`password_hash = $${params.length}`);
      }
      params.push(userId);
      await client.query(
        `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length}`,
        params,
      );
    }

    await replaceConciEmpresas(client, userId, ids);
  });

  return { username: user, role, empresaId: primaryId, empresaIds: ids };
}

async function provisionNcmUser({
  email,
  name,
  password,
  passwordHash,
  role = "consulta",
  companyId,
  companyIds,
  updatePassword = true,
}) {
  const mail = normalizeEmail(email);
  if (!mail || !mail.includes("@")) throw new Error("E-mail NCM inválido.");
  if (!["admin", "consulta", "superadmin"].includes(role)) {
    throw new Error("Papel NCM deve ser admin, consulta ou superadmin.");
  }
  const ids = role === "superadmin"
    ? []
    : asIdList(companyIds && companyIds.length ? companyIds : companyId);
  if (role !== "superadmin" && !ids.length) throw new Error("Empresa NCM é obrigatória.");
  const primaryId = role === "superadmin" ? null : ids[0];

  let hash = passwordHash ? String(passwordHash) : null;
  if (!hash && password) {
    hash = await bcrypt.hash(String(password), 12);
  }

  const displayName = String(name || mail).trim();

  await withClient(ncmConfig(), async (client) => {
    await ensureNcmUserCompanies(client);
    for (const id of ids) {
      const company = await client.query(
        "SELECT id FROM companies WHERE id = $1 LIMIT 1",
        [id],
      );
      if (!company.rowCount) throw new Error("Empresa NCM não encontrada.");
    }

    const existing = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [mail],
    );

    let userId;
    if (!existing.rowCount) {
      if (!hash) throw new Error("Senha é obrigatória para provisionar NCM.");
      const inserted = await client.query(
        `INSERT INTO users (company_id, email, password_hash, name, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [primaryId, mail, hash, displayName, role],
      );
      userId = inserted.rows[0].id;
    } else {
      userId = existing.rows[0].id;
      const sets = ["company_id = $1", "name = $2", "role = $3"];
      const params = [primaryId, displayName, role];
      if (hash && updatePassword) {
        params.push(hash);
        sets.push(`password_hash = $${params.length}`);
      }
      params.push(userId);
      await client.query(
        `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length}`,
        params,
      );
    }

    await replaceNcmCompanies(client, userId, ids);
  });

  return { email: mail, role, companyId: primaryId, companyIds: ids };
}

async function deprovisionConciUser(username) {
  const user = normalizeUsername(username);
  if (!user) return;
  await withClient(conciConfig(), async (client) => {
    await client.query(
      "UPDATE users SET ativo = false WHERE LOWER(username) = LOWER($1)",
      [user],
    );
  });
}

async function deprovisionNcmUser(email) {
  const mail = normalizeEmail(email);
  if (!mail) return;
  await withClient(ncmConfig(), async (client) => {
    await client.query(
      "DELETE FROM users WHERE LOWER(email) = LOWER($1) AND role <> 'superadmin'",
      [mail],
    );
  });
}

async function provisionUserToModules(hubUser, { modules, moduleMeta, password, passwordHash }) {
  const list = Array.isArray(modules) ? modules : [];
  validateModuleMeta(list, moduleMeta);

  if (list.includes("conci")) {
    await provisionConciUser({
      username: hubUser.username,
      password,
      passwordHash,
      displayName: hubUser.displayName || hubUser.username,
      role: moduleMeta.conci.role,
      empresaId: moduleMeta.conci.empresaId,
      empresaIds: moduleMeta.conci.empresaIds,
    });
  }

  if (list.includes("ncm")) {
    await provisionNcmUser({
      email: hubUser.email,
      name: hubUser.displayName || hubUser.username,
      password,
      passwordHash,
      role: moduleMeta.ncm.role,
      companyId: moduleMeta.ncm.companyId,
      companyIds: moduleMeta.ncm.companyIds,
    });
  }
}

async function syncUserModules(hubUser, { modules, moduleMeta, password, passwordHash }) {
  const list = Array.isArray(modules) ? modules : [];
  validateModuleMeta(list, moduleMeta);

  if (list.includes("conci")) {
    await provisionConciUser({
      username: hubUser.username,
      password,
      passwordHash,
      displayName: hubUser.displayName || hubUser.username,
      role: moduleMeta.conci.role,
      empresaId: moduleMeta.conci.empresaId,
      empresaIds: moduleMeta.conci.empresaIds,
    });
  } else if (hubUser.username) {
    await deprovisionConciUser(hubUser.username);
  }

  if (list.includes("ncm")) {
    await provisionNcmUser({
      email: hubUser.email,
      name: hubUser.displayName || hubUser.username,
      password,
      passwordHash,
      role: moduleMeta.ncm.role,
      companyId: moduleMeta.ncm.companyId,
      companyIds: moduleMeta.ncm.companyIds,
    });
  } else if (hubUser.email) {
    await deprovisionNcmUser(hubUser.email);
  }
}

module.exports = {
  listConciEmpresas,
  listNcmCompanies,
  parseModuleMeta,
  validateModuleMeta,
  masterModuleMeta,
  isMasterFlag,
  loadUserModuleMeta,
  loadUsersModuleMeta,
  provisionConciUser,
  provisionNcmUser,
  provisionUserToModules,
  syncUserModules,
  deprovisionConciUser,
  deprovisionNcmUser,
  conciHubEmail,
  asIdList,
};

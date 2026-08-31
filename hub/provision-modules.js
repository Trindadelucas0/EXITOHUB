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

function parseModuleMeta(body) {
  const conciRole = String(body.conci_role || "empresa").trim();
  const ncmRole = String(body.ncm_role || "consulta").trim();
  return {
    conci: {
      role: conciRole === "admin" ? "admin" : "empresa",
      empresaId: String(body.conci_empresa_id || "").trim() || null,
    },
    ncm: {
      role: ncmRole === "admin" ? "admin" : "consulta",
      companyId: String(body.ncm_company_id || "").trim() || null,
    },
  };
}

function validateModuleMeta(modules, moduleMeta) {
  const allowed = Array.isArray(modules) ? modules : [];
  if (allowed.includes("conci")) {
    if (!moduleMeta?.conci?.role) {
      throw new Error("Informe o papel na Conciliação (admin ou empresa).");
    }
    if (moduleMeta.conci.role === "empresa" && !moduleMeta.conci.empresaId) {
      throw new Error("Usuário Conciliação (empresa) precisa de uma empresa vinculada.");
    }
  }
  if (allowed.includes("ncm")) {
    if (!moduleMeta?.ncm?.role) {
      throw new Error("Informe o papel no NCM (admin ou consulta).");
    }
    if (!moduleMeta.ncm.companyId) {
      throw new Error("Usuário NCM precisa de uma empresa vinculada.");
    }
  }
}

async function loadUserModuleMeta(hubUser) {
  const meta = {
    conci: { role: "empresa", empresaId: null },
    ncm: { role: "consulta", companyId: null },
  };
  if (!hubUser) return meta;

  if (hubUser.canConci) {
    await withClient(conciConfig(), async (client) => {
      const result = await client.query(
        `SELECT role, empresa_id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
        [hubUser.username],
      );
      if (result.rowCount) {
        meta.conci.role = result.rows[0].role;
        meta.conci.empresaId = result.rows[0].empresa_id || null;
      }
    });
  }

  if (hubUser.canNcm) {
    await withClient(ncmConfig(), async (client) => {
      const result = await client.query(
        `SELECT role, company_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [hubUser.email],
      );
      if (result.rowCount) {
        meta.ncm.role = result.rows[0].role;
        meta.ncm.companyId = result.rows[0].company_id || null;
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
  updatePassword = true,
}) {
  const user = normalizeUsername(username);
  if (!user) throw new Error("Usuário Conciliação é obrigatório.");
  if (role === "empresa" && !empresaId) {
    throw new Error("Empresa Conciliação é obrigatória para papel empresa.");
  }

  let hash = passwordHash ? String(passwordHash) : null;
  if (!hash && password) {
    hash = await bcrypt.hash(String(password), 10);
  }

  await withClient(conciConfig(), async (client) => {
    if (role === "empresa") {
      const empresa = await client.query(
        "SELECT id, ativo FROM empresas WHERE id = $1 LIMIT 1",
        [empresaId],
      );
      if (!empresa.rowCount) throw new Error("Empresa Conciliação não encontrada.");
      if (empresa.rows[0].ativo === false) throw new Error("Empresa Conciliação está inativa.");
    }

    const existing = await client.query(
      "SELECT id, password_hash FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [user],
    );

    if (!existing.rowCount) {
      if (!hash) throw new Error("Senha é obrigatória para provisionar Conciliação.");
      await client.query(
        `INSERT INTO users (username, password_hash, role, empresa_id, ativo)
         VALUES ($1, $2, $3, $4, true)`,
        [user, hash, role, role === "empresa" ? empresaId : null],
      );
      return;
    }

    const sets = ["role = $1", "empresa_id = $2", "ativo = true"];
    const params = [role, role === "empresa" ? empresaId : null];
    if (hash && updatePassword) {
      params.push(hash);
      sets.push(`password_hash = $${params.length}`);
    }
    params.push(existing.rows[0].id);
    await client.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length}`,
      params,
    );
  });

  return { username: user, role, empresaId };
}

async function provisionNcmUser({
  email,
  name,
  password,
  passwordHash,
  role = "consulta",
  companyId,
  updatePassword = true,
}) {
  const mail = normalizeEmail(email);
  if (!mail || !mail.includes("@")) throw new Error("E-mail NCM inválido.");
  if (!companyId) throw new Error("Empresa NCM é obrigatória.");
  if (!["admin", "consulta"].includes(role)) {
    throw new Error("Papel NCM deve ser admin ou consulta.");
  }

  let hash = passwordHash ? String(passwordHash) : null;
  if (!hash && password) {
    hash = await bcrypt.hash(String(password), 12);
  }

  const displayName = String(name || mail).trim();

  await withClient(ncmConfig(), async (client) => {
    const company = await client.query(
      "SELECT id FROM companies WHERE id = $1 LIMIT 1",
      [companyId],
    );
    if (!company.rowCount) throw new Error("Empresa NCM não encontrada.");

    const existing = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [mail],
    );

    if (!existing.rowCount) {
      if (!hash) throw new Error("Senha é obrigatória para provisionar NCM.");
      await client.query(
        `INSERT INTO users (company_id, email, password_hash, name, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [companyId, mail, hash, displayName, role],
      );
      return;
    }

    const sets = ["company_id = $1", "name = $2", "role = $3"];
    const params = [companyId, displayName, role];
    if (hash && updatePassword) {
      params.push(hash);
      sets.push(`password_hash = $${params.length}`);
    }
    params.push(existing.rows[0].id);
    await client.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length}`,
      params,
    );
  });

  return { email: mail, role, companyId };
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
  loadUserModuleMeta,
  loadUsersModuleMeta,
  provisionConciUser,
  provisionNcmUser,
  provisionUserToModules,
  syncUserModules,
  deprovisionConciUser,
  deprovisionNcmUser,
  conciHubEmail,
};

"use strict";

const path = require("path");
const dotenv = require("dotenv");

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

module.exports = {
  resolveHost,
  hubConfig,
  ncmConfig,
  conciConfig,
};

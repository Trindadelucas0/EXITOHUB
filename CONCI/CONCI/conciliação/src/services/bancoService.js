'use strict';

const { query } = require('../db/pool');

function mapBanco(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    codigoCredito: row.codigo_credito,
    ativo: row.ativo,
    createdAt: row.created_at,
  };
}

async function listBancos({ onlyAtivos = false } = {}) {
  const result = await query(
    `SELECT id, nome, codigo_credito, ativo, created_at
     FROM bancos
     ${onlyAtivos ? 'WHERE ativo = true' : ''}
     ORDER BY nome ASC`,
  );
  return result.rows.map(mapBanco);
}

async function getBancoById(id) {
  if (!id) return null;
  const result = await query(
    `SELECT id, nome, codigo_credito, ativo, created_at
     FROM bancos
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return mapBanco(result.rows[0]);
}

async function getFirstActiveBanco() {
  const result = await query(
    `SELECT id, nome, codigo_credito, ativo, created_at
     FROM bancos
     WHERE ativo = true
     ORDER BY
       CASE WHEN nome = 'ITAU' THEN 0 ELSE 1 END,
       nome ASC
     LIMIT 1`,
  );
  return mapBanco(result.rows[0]);
}

async function createBanco({ nome, codigoCredito }) {
  const nomeNorm = String(nome || '').trim().toUpperCase();
  if (!nomeNorm) throw new Error('Nome do banco e obrigatorio');
  const credito = Number(codigoCredito);
  if (!Number.isFinite(credito)) throw new Error('Codigo de credito invalido');

  try {
    const result = await query(
      `INSERT INTO bancos (nome, codigo_credito, ativo)
       VALUES ($1, $2, true)
       RETURNING id, nome, codigo_credito, ativo, created_at`,
      [nomeNorm, credito],
    );
    return mapBanco(result.rows[0]);
  } catch (err) {
    if (err && err.code === '23505') {
      throw new Error(`Ja existe banco com nome "${nomeNorm}"`);
    }
    throw err;
  }
}

async function updateBanco(id, { nome, codigoCredito, ativo }) {
  const current = await getBancoById(id);
  if (!current) throw new Error('Banco nao encontrado');

  const nomeNorm = nome != null ? String(nome).trim().toUpperCase() : current.nome;
  if (!nomeNorm) throw new Error('Nome do banco e obrigatorio');

  let credito = current.codigoCredito;
  if (codigoCredito !== undefined && codigoCredito !== null && String(codigoCredito).trim() !== '') {
    credito = Number(codigoCredito);
    if (!Number.isFinite(credito)) throw new Error('Codigo de credito invalido');
  }

  let ativoVal = current.ativo;
  if (typeof ativo === 'boolean') ativoVal = ativo;

  try {
    const result = await query(
      `UPDATE bancos
       SET nome = $2, codigo_credito = $3, ativo = $4
       WHERE id = $1
       RETURNING id, nome, codigo_credito, ativo, created_at`,
      [id, nomeNorm, credito, ativoVal],
    );
    return mapBanco(result.rows[0]);
  } catch (err) {
    if (err && err.code === '23505') {
      throw new Error(`Ja existe banco com nome "${nomeNorm}"`);
    }
    throw err;
  }
}

module.exports = {
  listBancos,
  getBancoById,
  getFirstActiveBanco,
  createBanco,
  updateBanco,
};

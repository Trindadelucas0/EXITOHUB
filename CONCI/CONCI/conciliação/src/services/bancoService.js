'use strict';

const { query } = require('../db/pool');

const BANCO_SELECT = `SELECT b.id, b.nome, b.codigo_credito, b.ativo, b.created_at,
            b.empresa_id, e.nome AS empresa_nome
     FROM bancos b
     LEFT JOIN empresas e ON e.id = b.empresa_id`;

const BANCO_RETURNING = 'RETURNING id, nome, codigo_credito, ativo, created_at, empresa_id';

function mapBanco(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    codigoCredito: row.codigo_credito,
    ativo: row.ativo,
    createdAt: row.created_at,
    empresaId: row.empresa_id || null,
    empresaNome: row.empresa_nome || null,
  };
}

function normalizeEmpresaId(empresaId) {
  const id = String(empresaId || '').trim();
  if (!id) throw new Error('Escolha a empresa do banco');
  return id;
}

function translateDbError(err, nomeNorm) {
  if (err && err.code === '23505') {
    return new Error(`Ja existe banco com nome "${nomeNorm}"`);
  }
  if (err && (err.code === '23503' || err.code === '22P02')) {
    return new Error('Empresa invalida. Escolha uma empresa da lista.');
  }
  return err;
}

/**
 * Sem `empresaId`: todos os bancos (tela do admin).
 * Com `empresaId`: só os bancos dessa empresa.
 */
async function listBancos({ onlyAtivos = false, empresaId } = {}) {
  // empresaId passado vazio não pode virar "todos os bancos" numa tela de empresa.
  if (empresaId !== undefined && !empresaId) return [];

  const where = [];
  const params = [];
  if (empresaId) {
    params.push(empresaId);
    where.push(`b.empresa_id = $${params.length}`);
  }
  if (onlyAtivos) where.push('b.ativo = true');

  const result = await query(
    `${BANCO_SELECT}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY b.nome ASC`,
    params,
  );
  return result.rows.map(mapBanco);
}

async function getBancoById(id) {
  if (!id) return null;
  const result = await query(
    `${BANCO_SELECT}
     WHERE b.id = $1
     LIMIT 1`,
    [id],
  );
  return mapBanco(result.rows[0]);
}

async function getFirstActiveBanco({ empresaId } = {}) {
  if (!empresaId) return null;
  const result = await query(
    `${BANCO_SELECT}
     WHERE b.ativo = true AND b.empresa_id = $1
     ORDER BY
       CASE WHEN b.nome = 'ITAU' THEN 0 ELSE 1 END,
       b.nome ASC
     LIMIT 1`,
    [empresaId],
  );
  return mapBanco(result.rows[0]);
}

async function createBanco({ nome, codigoCredito, empresaId }) {
  const nomeNorm = String(nome || '').trim().toUpperCase();
  if (!nomeNorm) throw new Error('Nome do banco e obrigatorio');
  const credito = Number(codigoCredito);
  if (!Number.isFinite(credito)) throw new Error('Codigo de credito invalido');
  const empresa = normalizeEmpresaId(empresaId);

  try {
    const result = await query(
      `INSERT INTO bancos (nome, codigo_credito, ativo, empresa_id)
       VALUES ($1, $2, true, $3)
       ${BANCO_RETURNING}`,
      [nomeNorm, credito, empresa],
    );
    return mapBanco(result.rows[0]);
  } catch (err) {
    throw translateDbError(err, nomeNorm);
  }
}

async function updateBanco(id, { nome, codigoCredito, ativo, empresaId }) {
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

  const empresa = empresaId === undefined ? current.empresaId : normalizeEmpresaId(empresaId);

  try {
    const result = await query(
      `UPDATE bancos
       SET nome = $2, codigo_credito = $3, ativo = $4, empresa_id = $5
       WHERE id = $1
       ${BANCO_RETURNING}`,
      [id, nomeNorm, credito, ativoVal, empresa],
    );
    return mapBanco(result.rows[0]);
  } catch (err) {
    throw translateDbError(err, nomeNorm);
  }
}

/** Banco ativo e da empresa informada; senão null. */
async function getBancoDaEmpresa(id, empresaId) {
  if (!id || !empresaId) return null;
  let banco;
  try {
    banco = await getBancoById(id);
  } catch (err) {
    if (err && err.code === '22P02') return null;
    throw err;
  }
  if (!banco || !banco.ativo || banco.empresaId !== empresaId) return null;
  return banco;
}

module.exports = {
  listBancos,
  getBancoById,
  getBancoDaEmpresa,
  getFirstActiveBanco,
  createBanco,
  updateBanco,
};

'use strict';

const fs = require('fs');
const path = require('path');
const { query, getPool } = require('./db');

const META_KEY = 'carteira_empresas_seed_v1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEED_PATH = path.join(__dirname, 'data', 'carteira-empresas.json');

const REGIMES = [
  'Simples Nacional',
  'MEI',
  'Não encontrado',
  'Não optante pelo Simples (Lucro Presumido ou Real – não informado publicamente)',
];

const ESTABELECIMENTOS = ['MATRIZ', 'FILIAL', 'CPF'];
const SITUACOES = ['Ativa', 'Inativa', 'M'];
const TIPOS = ['comercio', 'servico', 'industria'];
const REGIME_NAO_OPTANTE = REGIMES[3];

function trimStr(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function bodyFlag(value) {
  if (Array.isArray(value)) value = value[value.length - 1];
  return value === '1' || value === 'on' || value === true;
}

function fieldError(message, field, status = 400) {
  const err = new Error(message);
  err.status = status;
  err.field = field;
  return err;
}

function isUuid(value) {
  return UUID_RE.test(String(value || '').trim());
}

function digitsOnly(value, max = 20) {
  return String(value == null ? '' : value).replace(/\D/g, '').slice(0, max);
}

function formatDocumento(value) {
  const d = digitsOnly(value, 20);
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return trimStr(value, 32);
}

function tipoLabel(row) {
  const parts = [];
  if (row && row.comercio) parts.push('Comércio');
  if (row && row.servico) parts.push('Serviço');
  if (row && row.industria) parts.push('Indústria');
  return parts.join(' e ');
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo,
    razao: row.razao,
    uf: row.uf || '',
    documento: row.documento || '',
    documentoFmt: formatDocumento(row.documento),
    regime: row.regime || '',
    regimeCurto: row.regime === REGIME_NAO_OPTANTE ? 'Não optante pelo Simples' : (row.regime || ''),
    estabelecimento: row.estabelecimento || '',
    situacao: row.situacao || '',
    cnae: row.cnae || '',
    cnae_secundario: row.cnae_secundario || '',
    servico: Boolean(row.servico),
    comercio: Boolean(row.comercio),
    industria: Boolean(row.industria),
    tipo: tipoLabel(row),
    contato: row.contato || '',
    email: row.email || '',
    socio_1: row.socio_1 || '',
    socio_2: row.socio_2 || '',
    socio_3: row.socio_3 || '',
    socio_4: row.socio_4 || '',
    socio_5: row.socio_5 || '',
    socio_6: row.socio_6 || '',
    socio_7: row.socio_7 || '',
    observacoes: row.observacoes || '',
  };
}

function parseDraft(body) {
  return {
    codigo: trimStr(body && body.codigo, 40),
    razao: trimStr(body && body.razao, 200),
    uf: trimStr(body && body.uf, 2).toUpperCase(),
    documento: digitsOnly(body && body.documento, 20),
    regime: trimStr(body && body.regime, 120),
    estabelecimento: trimStr(body && body.estabelecimento, 20),
    situacao: trimStr(body && body.situacao, 20),
    cnae: trimStr(body && body.cnae, 2000),
    cnae_secundario: trimStr(body && body.cnae_secundario, 8000),
    servico: bodyFlag(body && body.servico),
    comercio: bodyFlag(body && body.comercio),
    industria: bodyFlag(body && body.industria),
    contato: trimStr(body && body.contato, 200),
    email: trimStr(body && body.email, 200),
    socio_1: trimStr(body && body.socio_1, 200),
    socio_2: trimStr(body && body.socio_2, 200),
    socio_3: trimStr(body && body.socio_3, 200),
    socio_4: trimStr(body && body.socio_4, 200),
    socio_5: trimStr(body && body.socio_5, 200),
    socio_6: trimStr(body && body.socio_6, 200),
    socio_7: trimStr(body && body.socio_7, 200),
    observacoes: trimStr(body && body.observacoes, 4000),
  };
}

function parsePayload(body) {
  const data = parseDraft(body);
  if (!data.codigo) throw fieldError('Informe o código.', 'codigo');
  if (!data.razao) throw fieldError('Informe a razão social.', 'razao');
  if (data.uf && !/^[A-Z]{2}$/.test(data.uf)) {
    throw fieldError('UF inválida.', 'uf');
  }
  if (data.regime && !REGIMES.includes(data.regime)) {
    throw fieldError('Regime tributário inválido.', 'regime');
  }
  if (data.estabelecimento && !ESTABELECIMENTOS.includes(data.estabelecimento)) {
    throw fieldError('Matriz/Filial inválido.', 'estabelecimento');
  }
  if (data.situacao && !SITUACOES.includes(data.situacao)) {
    throw fieldError('Situação inválida.', 'situacao');
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    throw fieldError('E-mail inválido.', 'email');
  }
  return data;
}

function wrapUnique(err) {
  if (err && err.code === '23505') {
    throw fieldError('Código já cadastrado', 'codigo', 409);
  }
  throw err;
}

const COLS = `id, codigo, razao, uf, documento, regime, estabelecimento, situacao,
  cnae, cnae_secundario, servico, comercio, industria, contato, email,
  socio_1, socio_2, socio_3, socio_4, socio_5, socio_6, socio_7, observacoes`;

const INSERT_SQL = `
  INSERT INTO carteira_empresas (
    codigo, razao, uf, documento, regime, estabelecimento, situacao,
    cnae, cnae_secundario, servico, comercio, industria, contato, email,
    socio_1, socio_2, socio_3, socio_4, socio_5, socio_6, socio_7, observacoes
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
  )
  RETURNING ${COLS}
`;

function insertParams(data) {
  return [
    data.codigo,
    data.razao,
    data.uf || null,
    data.documento || null,
    data.regime || null,
    data.estabelecimento || null,
    data.situacao || null,
    data.cnae || null,
    data.cnae_secundario || null,
    Boolean(data.servico),
    Boolean(data.comercio),
    Boolean(data.industria),
    data.contato || null,
    data.email || null,
    data.socio_1 || null,
    data.socio_2 || null,
    data.socio_3 || null,
    data.socio_4 || null,
    data.socio_5 || null,
    data.socio_6 || null,
    data.socio_7 || null,
    data.observacoes || null,
  ];
}

async function seedCarteiraOnce() {
  const done = await query('SELECT 1 FROM hub_meta WHERE key = $1 LIMIT 1', [META_KEY]);
  if (done.rowCount) return;
  if (!fs.existsSync(SEED_PATH)) {
    console.error('[hub] seed carteira: JSON ausente em hub/data/carteira-empresas.json');
    return;
  }
  let rows;
  try {
    rows = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  } catch (err) {
    console.error('[hub] seed carteira: JSON inválido', err.message);
    return;
  }
  if (!Array.isArray(rows) || !rows.length) {
    console.error('[hub] seed carteira: JSON vazio');
    return;
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const data = parsePayload({
        ...row,
        servico: row.servico ? '1' : '',
        comercio: row.comercio ? '1' : '',
        industria: row.industria ? '1' : '',
      });
      await client.query(INSERT_SQL, insertParams(data));
    }
    await client.query(
      `INSERT INTO hub_meta (key, value) VALUES ($1, '1')
       ON CONFLICT (key) DO NOTHING`,
      [META_KEY],
    );
    await client.query('COMMIT');
    console.log(`[hub] carteira: ${rows.length} empresas`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function buildCarteiraWhere(filters = {}) {
  const clauses = [];
  const params = [];
  const q = trimStr(filters.q, 120);
  if (q) {
    params.push(`%${q}%`);
    const qi = params.length;
    const digits = digitsOnly(q, 20);
    if (digits.length >= 3) {
      params.push(`%${digits}%`);
      clauses.push(`(codigo ILIKE $${qi} OR razao ILIKE $${qi} OR documento ILIKE $${params.length})`);
    } else {
      clauses.push(`(codigo ILIKE $${qi} OR razao ILIKE $${qi} OR documento ILIKE $${qi})`);
    }
  }
  if (SITUACOES.includes(filters.sit)) {
    params.push(filters.sit);
    clauses.push(`situacao = $${params.length}`);
  }
  if (REGIMES.includes(filters.regime)) {
    params.push(filters.regime);
    clauses.push(`regime = $${params.length}`);
  }
  if (TIPOS.includes(filters.tipo)) {
    clauses.push(`${filters.tipo} = true`);
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

async function listCarteira(filters = {}, paging = {}) {
  const { where, params } = buildCarteiraWhere(filters);
  let sql = `SELECT ${COLS}
     FROM carteira_empresas
     ${where}
     ORDER BY
       CASE WHEN codigo ~ '^[0-9]+$' THEN codigo::bigint END NULLS LAST,
       codigo,
       razao`;
  const limit = Number.isFinite(Number(paging.limit)) && Number(paging.limit) > 0
    ? Math.floor(Number(paging.limit))
    : null;
  const offset = Number.isFinite(Number(paging.offset)) && Number(paging.offset) >= 0
    ? Math.floor(Number(paging.offset))
    : 0;
  if (limit != null) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;
  }
  const result = await query(sql, params);
  return result.rows.map(mapRow);
}

async function countCarteira(filters = {}) {
  const { where, params } = buildCarteiraWhere(filters);
  const result = await query(
    `SELECT COUNT(*)::int AS n FROM carteira_empresas ${where}`,
    params,
  );
  return result.rows[0] ? result.rows[0].n : 0;
}

async function getCarteira(id) {
  if (!isUuid(id)) return null;
  const result = await query(
    `SELECT ${COLS} FROM carteira_empresas WHERE id = $1 LIMIT 1`,
    [id],
  );
  return mapRow(result.rows[0]);
}

async function createCarteira(body) {
  const data = parsePayload(body);
  try {
    const result = await query(INSERT_SQL, insertParams(data));
    return mapRow(result.rows[0]);
  } catch (err) {
    wrapUnique(err);
  }
}

async function updateCarteira(id, body) {
  if (!isUuid(id)) return null;
  const data = parsePayload(body);
  try {
    const result = await query(
      `UPDATE carteira_empresas SET
        codigo = $2,
        razao = $3,
        uf = $4,
        documento = $5,
        regime = $6,
        estabelecimento = $7,
        situacao = $8,
        cnae = $9,
        cnae_secundario = $10,
        servico = $11,
        comercio = $12,
        industria = $13,
        contato = $14,
        email = $15,
        socio_1 = $16,
        socio_2 = $17,
        socio_3 = $18,
        socio_4 = $19,
        socio_5 = $20,
        socio_6 = $21,
        socio_7 = $22,
        observacoes = $23,
        updated_at = NOW()
       WHERE id = $1
       RETURNING ${COLS}`,
      [id, ...insertParams(data)],
    );
    return mapRow(result.rows[0] || null);
  } catch (err) {
    wrapUnique(err);
  }
}

async function deleteCarteira(id) {
  if (!isUuid(id)) return false;
  const result = await query(
    'DELETE FROM carteira_empresas WHERE id = $1 RETURNING id',
    [id],
  );
  return result.rowCount > 0;
}

module.exports = {
  REGIMES,
  ESTABELECIMENTOS,
  SITUACOES,
  TIPOS,
  META_KEY,
  isUuid,
  formatDocumento,
  tipoLabel,
  parseDraft,
  seedCarteiraOnce,
  listCarteira,
  countCarteira,
  getCarteira,
  createCarteira,
  updateCarteira,
  deleteCarteira,
};

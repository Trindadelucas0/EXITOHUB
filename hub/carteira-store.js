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
  'Lucro Presumido',
  'Lucro Real',
  'Não encontrado',
];

const REGIME_NAO_OPTANTE = 'Não optante pelo Simples (Lucro Presumido ou Real \u2013 não informado publicamente)';
const REGIMES_FILTRO = REGIMES.concat([REGIME_NAO_OPTANTE]);
const ANO_PADRAO = 2026;
const ANO_MIN = 1990;
const ANO_MAX = 2100;

const ESTABELECIMENTOS = ['MATRIZ', 'FILIAL', 'CPF'];
const SITUACOES = ['Ativa', 'Inativa', 'M'];
const TIPOS = ['comercio', 'servico', 'industria'];

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

function regimeCss(regime) {
  if (regime === 'Simples Nacional') return 'simples';
  if (regime === 'MEI') return 'mei';
  if (regime === 'Lucro Presumido') return 'presumido';
  if (regime === 'Lucro Real') return 'real';
  if (regime === REGIME_NAO_OPTANTE) return 'nao-optante';
  if (regime === 'Não encontrado' || !regime) return 'ausente';
  return 'ausente';
}

function regimeCurto(regime) {
  if (regime === REGIME_NAO_OPTANTE) return 'Não optante pelo Simples';
  return regime || '';
}

function decorateRegime(ano, regime) {
  const text = regime || '';
  return {
    ano: Number(ano),
    regime: text,
    regimeCurto: regimeCurto(text),
    regimeCss: regimeCss(text),
  };
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function parseRegimeDraft(body) {
  const anos = asList(body && body.ano);
  const regimes = asList(body && body.regime_ano);
  const len = Math.max(anos.length, regimes.length);
  const rows = [];
  for (let i = 0; i < len; i += 1) {
    rows.push({
      ano: trimStr(anos[i], 4),
      regime: trimStr(regimes[i], 200),
    });
  }
  return rows;
}

function parseRegimeRows(body, allowLegacy) {
  const seen = new Set();
  const out = [];
  for (const row of parseRegimeDraft(body)) {
    if (!row.regime) continue;
    if (!/^\d{4}$/.test(row.ano)) {
      throw fieldError('Ano inválido.', 'ano');
    }
    const ano = Number(row.ano);
    if (ano < ANO_MIN || ano > ANO_MAX) {
      throw fieldError('Ano inválido.', 'ano');
    }
    if (seen.has(ano)) {
      throw fieldError('Ano já informado.', 'ano');
    }
    seen.add(ano);
    if (row.regime === REGIME_NAO_OPTANTE) {
      if (!allowLegacy) throw fieldError('Regime tributário inválido.', 'regime_ano');
    } else if (!REGIMES.includes(row.regime)) {
      throw fieldError('Regime tributário inválido.', 'regime_ano');
    }
    out.push({ ano, regime: row.regime });
  }
  return out;
}

function regimeDe2026(regimes) {
  const found = (regimes || []).find((row) => Number(row.ano) === ANO_PADRAO);
  return found ? found.regime : null;
}

function mapRow(row, regimes) {
  if (!row) return null;
  const regime = row.regime || '';
  const list = Array.isArray(regimes) ? regimes : [];
  return {
    id: row.id,
    codigo: row.codigo,
    razao: row.razao,
    uf: row.uf || '',
    documento: row.documento || '',
    documentoFmt: formatDocumento(row.documento),
    regime,
    regimeCurto: regimeCurto(regime),
    regimeCss: regimeCss(regime),
    regimes: list
      .map((item) => decorateRegime(item.ano, item.regime))
      .sort((a, b) => a.ano - b.ano),
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
    regime: trimStr(body && body.regime, 200),
    regimes: parseRegimeDraft(body),
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

function parsePayload(body, options = {}) {
  const data = parseDraft(body);
  if (!data.codigo) throw fieldError('Informe o código.', 'codigo');
  if (!data.razao) throw fieldError('Informe a razão social.', 'razao');
  if (data.uf && !/^[A-Z]{2}$/.test(data.uf)) {
    throw fieldError('UF inválida.', 'uf');
  }
  if (options.seed) {
    if (data.regime && !REGIMES_FILTRO.includes(data.regime)) {
      throw fieldError('Regime tributário inválido.', 'regime');
    }
    data.regimes = [];
  } else {
    data.regimes = parseRegimeRows(body, Boolean(options.allowLegacy));
    data.regime = regimeDe2026(data.regimes);
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
      }, { seed: true });
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

function normalizeAno(value) {
  const text = String(value == null ? '' : value).trim();
  if (!/^\d{4}$/.test(text)) return ANO_PADRAO;
  const ano = Number(text);
  if (ano < ANO_MIN || ano > ANO_MAX) return ANO_PADRAO;
  return ano;
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
  if (filters.regime && REGIMES_FILTRO.includes(filters.regime)) {
    const ano = normalizeAno(filters.ano);
    params.push(ano);
    const anoIdx = params.length;
    params.push(filters.regime);
    const regimeIdx = params.length;
    let regimeClause = `(EXISTS (
      SELECT 1 FROM carteira_regimes cr
      WHERE cr.empresa_id = carteira_empresas.id
        AND cr.ano = $${anoIdx}
        AND cr.regime = $${regimeIdx}
    )`;
    if (ano === ANO_PADRAO) {
      params.push(ANO_PADRAO);
      const anoPadraoIdx = params.length;
      regimeClause += ` OR (
        carteira_empresas.regime = $${regimeIdx}
        AND NOT EXISTS (
          SELECT 1 FROM carteira_regimes cr2
          WHERE cr2.empresa_id = carteira_empresas.id
            AND cr2.ano = $${anoPadraoIdx}
        )
      )`;
    }
    regimeClause += ')';
    clauses.push(regimeClause);
  }
  if (TIPOS.includes(filters.tipo)) {
    clauses.push(`${filters.tipo} = true`);
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

async function attachRegimes(rows) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const result = await query(
    `SELECT empresa_id, ano, regime
     FROM carteira_regimes
     WHERE empresa_id = ANY($1::uuid[])
     ORDER BY ano`,
    [ids],
  );
  const map = new Map();
  for (const item of result.rows) {
    const key = String(item.empresa_id);
    const list = map.get(key) || [];
    list.push({ ano: Number(item.ano), regime: item.regime });
    map.set(key, list);
  }
  return rows.map((row) => mapRow(row, map.get(String(row.id)) || []));
}

async function listCarteira(filters = {}, paging = {}) {
  const { where, params } = buildCarteiraWhere(filters);
  let sql = `SELECT ${COLS}
     FROM carteira_empresas
     ${where}
     ORDER BY
       CASE situacao
         WHEN 'Ativa' THEN 0
         WHEN 'Inativa' THEN 1
         WHEN 'M' THEN 2
         ELSE 3
       END,
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
  return attachRegimes(result.rows);
}

async function countCarteira(filters = {}) {
  const { where, params } = buildCarteiraWhere(filters);
  const result = await query(
    `SELECT COUNT(*)::int AS n FROM carteira_empresas ${where}`,
    params,
  );
  return result.rows[0] ? result.rows[0].n : 0;
}

async function listRegimeAnos() {
  const result = await query('SELECT DISTINCT ano FROM carteira_regimes');
  const anos = new Set([ANO_PADRAO, 2027]);
  for (const row of result.rows) {
    const ano = Number(row.ano);
    if (Number.isInteger(ano) && ano >= ANO_MIN && ano <= ANO_MAX) anos.add(ano);
  }
  return Array.from(anos).sort((a, b) => a - b);
}

async function getCarteira(id) {
  if (!isUuid(id)) return null;
  const result = await query(
    `SELECT ${COLS} FROM carteira_empresas WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (!result.rows[0]) return null;
  const mapped = await attachRegimes(result.rows);
  return mapped[0] || null;
}

async function empresaTemRegimeLegado(id) {
  if (!isUuid(id)) return false;
  const result = await query(
    `SELECT 1 FROM carteira_regimes WHERE empresa_id = $1 AND regime = $2
     UNION ALL
     SELECT 1 FROM carteira_empresas WHERE id = $1 AND regime = $2
     LIMIT 1`,
    [id, REGIME_NAO_OPTANTE],
  );
  return result.rowCount > 0;
}

async function writeRegimes(client, empresaId, regimes) {
  await client.query('DELETE FROM carteira_regimes WHERE empresa_id = $1', [empresaId]);
  for (const row of regimes) {
    await client.query(
      `INSERT INTO carteira_regimes (empresa_id, ano, regime) VALUES ($1, $2, $3)`,
      [empresaId, row.ano, row.regime],
    );
  }
}

async function createCarteira(body) {
  const data = parsePayload(body, { allowLegacy: false });
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(INSERT_SQL, insertParams(data));
    const row = result.rows[0];
    await writeRegimes(client, row.id, data.regimes);
    await client.query('COMMIT');
    return mapRow(row, data.regimes);
  } catch (err) {
    await client.query('ROLLBACK');
    wrapUnique(err);
  } finally {
    client.release();
  }
}

async function updateCarteira(id, body) {
  if (!isUuid(id)) return null;
  const allowLegacy = await empresaTemRegimeLegado(id);
  const data = parsePayload(body, { allowLegacy });
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
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
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    await writeRegimes(client, id, data.regimes);
    await client.query('COMMIT');
    return mapRow(result.rows[0], data.regimes);
  } catch (err) {
    await client.query('ROLLBACK');
    wrapUnique(err);
  } finally {
    client.release();
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
  REGIMES_FILTRO,
  REGIME_NAO_OPTANTE,
  ANO_PADRAO,
  ESTABELECIMENTOS,
  SITUACOES,
  TIPOS,
  META_KEY,
  isUuid,
  formatDocumento,
  tipoLabel,
  parseDraft,
  normalizeAno,
  seedCarteiraOnce,
  listCarteira,
  countCarteira,
  listRegimeAnos,
  getCarteira,
  empresaTemRegimeLegado,
  createCarteira,
  updateCarteira,
  deleteCarteira,
};

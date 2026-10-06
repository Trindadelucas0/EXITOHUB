'use strict';

const { query } = require('./db');
const {
  ANO_PADRAO,
  isUuid,
  listCarteira,
  countCarteira,
  listRegimeAnos,
} = require('./carteira-store');

const REGIME_APURACAO = 'Simples Nacional';

function trimQ(value) {
  return String(value == null ? '' : value).trim().slice(0, 120);
}

function apuracaoCarteiraFilters(filters = {}) {
  const q = trimQ(filters.q);
  return {
    q,
    regime: REGIME_APURACAO,
    ano: ANO_PADRAO,
  };
}

const ANEXOS_VALIDOS = new Set(['I', 'II', 'III', 'IV', 'V']);

function trimObs(value, max = 4000) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function normalizeAnexo(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  if (ANEXOS_VALIDOS.has(raw)) return raw;
  return null;
}

function regimeForYear(row, ano) {
  const list = Array.isArray(row && row.regimes) ? row.regimes : [];
  const found = list.find((item) => Number(item.ano) === Number(ano));
  if (found) return found.regimeCurto || found.regime || '';
  return '';
}

async function attachApuracaoData(rows) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const obsResult = await query(
    `SELECT empresa_id, observacao, anexo
     FROM apuracao_simples
     WHERE empresa_id = ANY($1::uuid[])`,
    [ids],
  );
  const dataMap = new Map();
  for (const item of obsResult.rows) {
    dataMap.set(String(item.empresa_id), {
      observacao: item.observacao || '',
      anexo: item.anexo || '',
    });
  }
  return rows.map((row) => {
    const data = dataMap.get(String(row.id)) || { observacao: '', anexo: '' };
    return {
      ...row,
      apuracaoObservacao: data.observacao,
      apuracaoAnexo: data.anexo,
    };
  });
}

async function listApuracaoSimples() {
  const carteiraFilters = apuracaoCarteiraFilters({});
  const [empresas, anos] = await Promise.all([
    listCarteira(carteiraFilters),
    listRegimeAnos(),
  ]);
  const rows = await attachApuracaoData(empresas);
  return { empresas: rows, anos };
}

async function countApuracaoSimples(filters = {}) {
  return countCarteira(apuracaoCarteiraFilters(filters));
}

async function empresaNaApuracao(id) {
  if (!isUuid(id)) return null;
  const result = await query(
    `SELECT id FROM carteira_empresas ce
     WHERE ce.id = $1
       AND (
         EXISTS (
           SELECT 1 FROM carteira_regimes cr
           WHERE cr.empresa_id = ce.id AND cr.ano = $2 AND cr.regime = 'Simples Nacional'
         )
         OR (
           ce.regime = 'Simples Nacional'
           AND NOT EXISTS (
             SELECT 1 FROM carteira_regimes cr2
             WHERE cr2.empresa_id = ce.id AND cr2.ano = $2
           )
         )
       )
     LIMIT 1`,
    [id, ANO_PADRAO],
  );
  return result.rowCount ? id : null;
}

async function saveObservacao(id, body) {
  const empresaId = await empresaNaApuracao(id);
  if (!empresaId) {
    const err = new Error('Empresa não encontrada.');
    err.status = 404;
    throw err;
  }
  const observacao = trimObs(body && body.observacao);
  const anexoParsed = normalizeAnexo(body && body.anexo);
  if (anexoParsed === null) {
    const err = new Error('Anexo inválido.');
    err.status = 400;
    throw err;
  }

  if (!observacao && !anexoParsed) {
    await query('DELETE FROM apuracao_simples WHERE empresa_id = $1', [empresaId]);
    return { observacao: '', anexo: '' };
  }

  await query(
    `INSERT INTO apuracao_simples (empresa_id, observacao, anexo, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (empresa_id) DO UPDATE SET
       observacao = EXCLUDED.observacao,
       anexo = EXCLUDED.anexo,
       updated_at = NOW()`,
    [empresaId, observacao || null, anexoParsed || null],
  );
  return { observacao, anexo: anexoParsed };
}

module.exports = {
  ANO_APURACAO: ANO_PADRAO,
  apuracaoCarteiraFilters,
  regimeForYear,
  listApuracaoSimples,
  countApuracaoSimples,
  saveObservacao,
};

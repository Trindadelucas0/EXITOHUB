'use strict';

const { query } = require('./db');
const { deleteStoredFile, getFileById } = require('./portal/upload');
const {
  ANO_PADRAO,
  isUuid,
  listCarteira,
  listRegimeAnos,
} = require('./carteira-store');

function trimObs(value, max = 4000) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function regimeForYear(row, ano) {
  const list = Array.isArray(row && row.regimes) ? row.regimes : [];
  const found = list.find((item) => Number(item.ano) === Number(ano));
  if (found) return found.regimeCurto || found.regime || '';
  return '';
}

function mapArquivoRow(row) {
  return {
    id: row.id,
    fileId: row.file_id,
    nome: row.original_name || 'Arquivo',
    mime: row.mime || '',
    url: `/fiscal/apuracao-simples/arquivo/${row.file_id}`,
    createdAt: row.created_at,
  };
}

async function attachApuracaoData(rows) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [obsResult, arqResult] = await Promise.all([
    query(
      `SELECT empresa_id, observacao
       FROM apuracao_simples
       WHERE empresa_id = ANY($1::uuid[])`,
      [ids],
    ),
    query(
      `SELECT a.id, a.empresa_id, a.file_id, a.created_at,
              f.original_name, f.mime
       FROM apuracao_simples_arquivos a
       JOIN portal_files f ON f.id = a.file_id
       WHERE a.empresa_id = ANY($1::uuid[])
       ORDER BY a.created_at, a.id`,
      [ids],
    ),
  ]);
  const obsMap = new Map();
  for (const item of obsResult.rows) {
    obsMap.set(String(item.empresa_id), item.observacao || '');
  }
  const arqMap = new Map();
  for (const item of arqResult.rows) {
    const key = String(item.empresa_id);
    const list = arqMap.get(key) || [];
    list.push(mapArquivoRow(item));
    arqMap.set(key, list);
  }
  return rows.map((row) => ({
    ...row,
    apuracaoObservacao: obsMap.get(String(row.id)) || '',
    apuracaoArquivos: arqMap.get(String(row.id)) || [],
  }));
}

async function listApuracaoSimples() {
  const [empresas, anos] = await Promise.all([
    listCarteira({ regime: 'Simples Nacional', ano: ANO_PADRAO }),
    listRegimeAnos(),
  ]);
  const rows = await attachApuracaoData(empresas);
  return { empresas: rows, anos };
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
  const arqCount = await query(
    'SELECT COUNT(*)::int AS n FROM apuracao_simples_arquivos WHERE empresa_id = $1',
    [empresaId],
  );
  const hasFiles = arqCount.rows[0] && arqCount.rows[0].n > 0;

  if (!observacao && !hasFiles) {
    await query('DELETE FROM apuracao_simples WHERE empresa_id = $1', [empresaId]);
    return { observacao: '' };
  }

  await query(
    `INSERT INTO apuracao_simples (empresa_id, observacao, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (empresa_id) DO UPDATE SET
       observacao = EXCLUDED.observacao,
       updated_at = NOW()`,
    [empresaId, observacao || null],
  );
  return { observacao };
}

async function addArquivo(empresaId, fileRow) {
  const id = await empresaNaApuracao(empresaId);
  if (!id) {
    const err = new Error('Empresa não encontrada.');
    err.status = 404;
    throw err;
  }
  if (!fileRow || !fileRow.id) {
    const err = new Error('Arquivo inválido.');
    err.status = 400;
    throw err;
  }
  const inserted = await query(
    `INSERT INTO apuracao_simples_arquivos (empresa_id, file_id)
     VALUES ($1, $2)
     RETURNING id, file_id, created_at`,
    [id, fileRow.id],
  );
  const row = inserted.rows[0];
  return mapArquivoRow({
    id: row.id,
    file_id: row.file_id,
    created_at: row.created_at,
    original_name: fileRow.original_name,
    mime: fileRow.mime,
  });
}

async function removeArquivo(empresaId, arquivoId) {
  const id = await empresaNaApuracao(empresaId);
  if (!id) {
    const err = new Error('Empresa não encontrada.');
    err.status = 404;
    throw err;
  }
  if (!isUuid(arquivoId)) {
    const err = new Error('Arquivo não encontrado.');
    err.status = 404;
    throw err;
  }
  const found = await query(
    `SELECT id, file_id FROM apuracao_simples_arquivos
     WHERE id = $1 AND empresa_id = $2 LIMIT 1`,
    [arquivoId, id],
  );
  if (!found.rowCount) {
    const err = new Error('Arquivo não encontrado.');
    err.status = 404;
    throw err;
  }
  const fileId = found.rows[0].file_id;
  await query('DELETE FROM apuracao_simples_arquivos WHERE id = $1', [arquivoId]);
  await deleteStoredFile(fileId);

  const obsRow = await query(
    'SELECT observacao FROM apuracao_simples WHERE empresa_id = $1 LIMIT 1',
    [id],
  );
  const obs = obsRow.rows[0] ? trimObs(obsRow.rows[0].observacao) : '';
  const remaining = await query(
    'SELECT COUNT(*)::int AS n FROM apuracao_simples_arquivos WHERE empresa_id = $1',
    [id],
  );
  const hasFiles = remaining.rows[0] && remaining.rows[0].n > 0;
  if (!obs && !hasFiles) {
    await query('DELETE FROM apuracao_simples WHERE empresa_id = $1', [id]);
  }
  return { ok: true };
}

async function getArquivoAutorizado(fileId) {
  if (!isUuid(fileId)) return null;
  const result = await query(
    `SELECT f.id, f.stored_path, f.original_name, f.mime, f.size_bytes
     FROM portal_files f
     INNER JOIN apuracao_simples_arquivos a ON a.file_id = f.id
     WHERE f.id = $1
     LIMIT 1`,
    [fileId],
  );
  return result.rows[0] || null;
}

module.exports = {
  ANO_APURACAO: ANO_PADRAO,
  regimeForYear,
  listApuracaoSimples,
  saveObservacao,
  addArquivo,
  removeArquivo,
  getArquivoAutorizado,
  getFileById,
};

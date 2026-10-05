'use strict';

/**
 * Confere o CNAE de cada CNPJ de 14 dígitos na BrasilAPI e grava
 * cnae, cnae_secundario e as três caixas (servico, comercio, industria).
 * Não altera regime, razão, sócios nem carteira_regimes.
 *
 * Uso: node hub/corrigir-carteira-cnae.js
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { query, closePool } = require('./db');

const SEED_PATH = path.join(__dirname, 'data', 'carteira-empresas.json');
const API_URL = 'https://brasilapi.com.br/api/cnpj/v1/';
const GAP_MS = 250;
const TIMEOUT_MS = 20000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function digitsOnly(value) {
  return String(value == null ? '' : value).replace(/\D/g, '');
}

function code7(value) {
  const digits = digitsOnly(value);
  if (!digits || digits.length > 7) return '';
  return digits.padStart(7, '0');
}

function trimText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function formatToken(code, descricao) {
  const text = trimText(descricao);
  return text ? `${code} - ${text}` : code;
}

function splitStored(text) {
  return String(text || '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
}

function tokenParts(token) {
  const match = String(token).trim().match(/^(\d+)(?:\s*-\s*([\s\S]*))?$/);
  if (!match) {
    return { code: '', rawDigits: '', descricao: String(token).trim(), already7: false };
  }
  const rawDigits = match[1];
  return {
    code: rawDigits.length > 0 && rawDigits.length <= 7 ? rawDigits.padStart(7, '0') : '',
    rawDigits,
    descricao: trimText(match[2] || ''),
    already7: rawDigits.length === 7,
  };
}

function flagsForCode(code) {
  if (!/^\d{7}$/.test(code)) return null;
  const divisao = Number(code.slice(0, 2));
  if (divisao >= 5 && divisao <= 33) return { industria: true };
  if (divisao >= 45 && divisao <= 47) return { comercio: true };
  if (divisao === 56) return { comercio: true, servico: true };
  return { servico: true };
}

function unionFlags(codes) {
  const flags = { servico: false, comercio: false, industria: false };
  let any = false;
  for (const code of codes) {
    const part = flagsForCode(code);
    if (!part) continue;
    any = true;
    if (part.servico) flags.servico = true;
    if (part.comercio) flags.comercio = true;
    if (part.industria) flags.industria = true;
  }
  return any ? flags : null;
}

function apiMap(payload) {
  const map = new Map();
  const principal = code7(payload && payload.cnae_fiscal);
  if (principal) {
    map.set(principal, trimText(payload.cnae_fiscal_descricao));
  }
  const lista = Array.isArray(payload && payload.cnaes_secundarios) ? payload.cnaes_secundarios : [];
  for (const item of lista) {
    const code = code7(item && item.codigo);
    if (!code || map.has(code)) continue;
    map.set(code, trimText(item && item.descricao));
  }
  return { principal, map };
}

function rewriteStored(text, map) {
  return splitStored(text).map((token) => {
    const parts = tokenParts(token);
    if (!parts.code) return token;
    if (parts.already7) return token;
    const descricao = map.has(parts.code) ? map.get(parts.code) : parts.descricao;
    return formatToken(parts.code, descricao);
  }).join(' | ');
}

function codesFromText(text) {
  const codes = [];
  for (const token of splitStored(text)) {
    const parts = tokenParts(token);
    if (parts.code) codes.push(parts.code);
  }
  return codes;
}

function sameText(a, b) {
  return String(a || '') === String(b || '');
}

function sameFlags(row, flags) {
  return Boolean(row.servico) === flags.servico
    && Boolean(row.comercio) === flags.comercio
    && Boolean(row.industria) === flags.industria;
}

function flagLabel(row) {
  return `S${row.servico ? 1 : 0} C${row.comercio ? 1 : 0} I${row.industria ? 1 : 0}`;
}

async function fetchCnpj(cnpj) {
  const url = `${API_URL}${cnpj}`;
  let lastStatus = 'erro';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'user-agent': 'exito-hub-carteira/1.5.49',
        },
      });
      lastStatus = response.status;
      if (response.status === 429 && attempt < 3) {
        await sleep(1000 * attempt);
        continue;
      }
      if (!response.ok) return { ok: false, status: response.status };
      const json = await response.json();
      return { ok: true, json };
    } catch (err) {
      lastStatus = err && err.name === 'AbortError' ? 'timeout' : 'erro';
      return { ok: false, status: lastStatus };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: lastStatus };
}

function decidir(row, payload) {
  const { principal, map } = apiMap(payload);
  if (!principal) return { alterar: false, motivo: 'sem código de 7 dígitos' };

  const gravado = tokenParts(splitStored(row.cnae)[0] || '').code;
  const principalIgual = gravado !== '' && gravado === principal;

  let cnae = row.cnae || '';
  let secundario = row.cnae_secundario || '';
  let codes = [];

  if (principalIgual) {
    cnae = rewriteStored(row.cnae, map);
    secundario = rewriteStored(row.cnae_secundario, map);
    codes = codesFromText(cnae).concat(codesFromText(secundario));
  } else {
    cnae = formatToken(principal, map.get(principal));
    const secundarios = [];
    for (const [code, descricao] of map) {
      if (code === principal) continue;
      secundarios.push(formatToken(code, descricao));
    }
    secundario = secundarios.join(' | ');
    codes = Array.from(map.keys());
  }

  const flags = unionFlags(codes);
  const next = {
    cnae,
    cnae_secundario: secundario,
    servico: flags ? flags.servico : Boolean(row.servico),
    comercio: flags ? flags.comercio : Boolean(row.comercio),
    industria: flags ? flags.industria : Boolean(row.industria),
  };
  const mudou = !sameText(row.cnae, next.cnae)
    || !sameText(row.cnae_secundario, next.cnae_secundario)
    || !sameFlags(row, next);
  return { alterar: mudou, next, principalIgual };
}

async function main() {
  const db = await query(
    `SELECT codigo, razao, documento, cnae, cnae_secundario, servico, comercio, industria
     FROM carteira_empresas
     ORDER BY CASE WHEN codigo ~ '^[0-9]+$' THEN codigo::bigint END NULLS LAST, codigo`,
  );
  const jsonRows = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const jsonByCodigo = new Map(jsonRows.map((row) => [String(row.codigo), row]));

  let consultados = 0;
  let alterados = 0;
  let falhas = 0;
  let pulados = 0;
  let jsonDirty = false;

  function espelharJson(codigo, source) {
    const jsonRow = jsonByCodigo.get(String(codigo));
    if (!jsonRow) return;
    const before = JSON.stringify([
      jsonRow.cnae, jsonRow.cnae_secundario, jsonRow.servico, jsonRow.comercio, jsonRow.industria,
    ]);
    jsonRow.cnae = source.cnae || '';
    jsonRow.cnae_secundario = source.cnae_secundario || '';
    jsonRow.servico = Boolean(source.servico);
    jsonRow.comercio = Boolean(source.comercio);
    jsonRow.industria = Boolean(source.industria);
    const after = JSON.stringify([
      jsonRow.cnae, jsonRow.cnae_secundario, jsonRow.servico, jsonRow.comercio, jsonRow.industria,
    ]);
    if (before !== after) jsonDirty = true;
  }

  for (const row of db.rows) {
    const cnpj = digitsOnly(row.documento);
    if (cnpj.length !== 14) {
      pulados += 1;
      console.log(`${row.codigo}\t${row.razao}\tnão consultado\tdocumento sem 14 dígitos`);
      continue;
    }

    const fetched = await fetchCnpj(cnpj);
    consultados += 1;
    await sleep(GAP_MS);

    if (!fetched.ok) {
      falhas += 1;
      console.log(`${row.codigo}\t${row.razao}\tAPI falhou\t${fetched.status}\tsem alteração`);
      continue;
    }

    const decisao = decidir(row, fetched.json);
    if (!decisao.alterar) {
      espelharJson(row.codigo, row);
      const motivo = decisao.motivo || 'sem mudança';
      console.log(`${row.codigo}\t${row.razao}\t${motivo}\t${flagLabel(row)}`);
      continue;
    }

    const next = decisao.next;
    await query(
      `UPDATE carteira_empresas
       SET cnae = $2,
           cnae_secundario = $3,
           servico = $4,
           comercio = $5,
           industria = $6,
           updated_at = NOW()
       WHERE codigo = $1`,
      [row.codigo, next.cnae || null, next.cnae_secundario || null, next.servico, next.comercio, next.industria],
    );

    espelharJson(row.codigo, next);

    alterados += 1;
    console.log(
      `${row.codigo}\t${row.razao}\tatualizado\t`
      + `cnae: ${row.cnae || '—'} => ${next.cnae || '—'}\t`
      + `secundario: ${row.cnae_secundario || '—'} => ${next.cnae_secundario || '—'}\t`
      + `${flagLabel(row)} => ${flagLabel(next)}`,
    );
  }

  if (jsonDirty) {
    const raw = fs.readFileSync(SEED_PATH, 'utf8');
    const newline = raw.includes('\r\n') ? '\r\n' : '\n';
    const body = `${JSON.stringify(jsonRows, null, 2)}\n`.replace(/\n/g, newline);
    fs.writeFileSync(SEED_PATH, body, 'utf8');
  }
  console.log(`resumo\tconsultados=${consultados}\talterados=${alterados}\tfalhas=${falhas}\tpulados=${pulados}`);
}

main()
  .catch((err) => {
    console.error('[carteira-cnae]', err && err.message ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

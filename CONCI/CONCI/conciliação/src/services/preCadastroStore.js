'use strict';

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DEFAULT_DATA_DIR = path.join(__dirname, '..', '..', 'data', 'precadastro');
/** Arquivo de referencia vazio — NUNCA aplicar automaticamente na conciliação. */
const SEED_PATH = path.join(__dirname, '..', 'config', 'preCadastroContas.json');

/** Descricao fixa no pre-cadastro para todos os recebimentos. */
const DESCRICAO_RECEBIMENTO_CLIENTES = 'RECEBIMENTO DE CLIENTES';

/** Classificacao CAP exibida para todo valor positivo do extrato. */
const CLASSIFICACAO_RECEBIMENTO = 'RECEBIMENTO';

/** Descricao fixa no pre-cadastro para tarifas TAR* (CAP fica em branco). */
const DESCRICAO_TARIFAS_BANCARIAS = 'TARIFAS BANCARIAS';

function getDataDir() {
  return process.env.PRE_CADASTRO_DIR || DEFAULT_DATA_DIR;
}

function ensureDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Chave de arquivo: empresa UUID vira empresa-{uuid}; testes podem passar sid simples.
 */
function storeKeyForEmpresa(empresaId) {
  if (!empresaId) throw new Error('empresaId invalido');
  const id = String(empresaId).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!id) throw new Error('empresaId invalido');
  return `empresa-${id}`;
}

/**
 * Chave por empresa + banco: empresa-{uuid}-banco-{bancoId}
 */
function storeKeyForEmpresaBanco(empresaId, bancoId) {
  if (!empresaId) throw new Error('empresaId invalido');
  if (!bancoId) throw new Error('bancoId invalido');
  const emp = String(empresaId).replace(/[^a-zA-Z0-9_-]/g, '');
  const ban = String(bancoId).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!emp) throw new Error('empresaId invalido');
  if (!ban) throw new Error('bancoId invalido');
  return `empresa-${emp}-banco-${ban}`;
}

/**
 * Chave estável para leitura/gravação. Nunca usa UUID de sessão de conciliação.
 * empresa+banco → empresa-{id}-banco-{id}; só empresa → legado empresa-{id}.
 */
function resolveStoreKey(empresaId, bancoId) {
  if (empresaId && bancoId) return storeKeyForEmpresaBanco(empresaId, bancoId);
  if (empresaId) return storeKeyForEmpresa(empresaId);
  return null;
}

/** empresa-{id}-banco-{id} → empresa-{id}; senão null. */
function legacyKeyFromBankStoreKey(storeKey) {
  const key = String(storeKey || '');
  if (!key.startsWith('empresa-')) return null;
  const marker = '-banco-';
  const idx = key.lastIndexOf(marker);
  if (idx <= 0) return null;
  const legacy = key.slice(0, idx);
  if (!legacy || legacy === key) return null;
  return legacy;
}

function emptyDoc(storeKey) {
  return {
    sessionId: storeKey,
    userId: storeKey.startsWith('empresa-') ? storeKey.slice('empresa-'.length) : null,
    itens: [],
  };
}

function filePathFor(storeKey) {
  if (!storeKey || !/^[a-zA-Z0-9_-]+$/.test(storeKey)) {
    throw new Error('storeKey invalido');
  }
  return path.join(getDataDir(), `${storeKey}.json`);
}

function toOptionalNumber(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function readSession(storeKey) {
  const fp = filePathFor(storeKey);
  if (!fs.existsSync(fp)) {
    return emptyDoc(storeKey);
  }
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return {
    sessionId: data.sessionId || storeKey,
    userId: data.userId ?? null,
    itens: Array.isArray(data.itens) ? data.itens : [],
  };
}

function writeSession(storeKey, doc) {
  ensureDir();
  const payload = {
    sessionId: storeKey,
    userId: doc.userId ?? null,
    itens: doc.itens || [],
  };
  fs.writeFileSync(filePathFor(storeKey), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

function list(storeKey) {
  if (!storeKey) return [];
  const itens = readSession(storeKey).itens;
  if (itens.length) return itens;
  const legacyKey = legacyKeyFromBankStoreKey(storeKey);
  if (!legacyKey) return itens;
  return readSession(legacyKey).itens;
}

function normalizeDescricao(descricao) {
  return String(descricao ?? '').trim().toUpperCase();
}

function stripAccentsUpper(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

const RECEBIMENTO_LOOKUP_KEYS = new Set([
  normalizeDescricao(DESCRICAO_RECEBIMENTO_CLIENTES),
  normalizeDescricao(CLASSIFICACAO_RECEBIMENTO),
]);

/**
 * Descricao contida no historico com limite de palavra
 * (evita ENERGIA dentro de NEOENERGIA).
 */
function containsAsWords(haystack, needle) {
  if (!haystack || !needle) return false;
  const escaped = needle
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  const re = new RegExp(`(?:^|[^A-Z0-9])${escaped}(?:[^A-Z0-9]|$)`);
  return re.test(haystack);
}

/**
 * Para residual sem CAP: casa historico do extrato com descricao do pre-cadastro.
 * Prioridade: igualdade exata; senao substring com limite de palavra; mais longa vence.
 */
function findBestPreByHistorico(storeKey, historico) {
  if (!storeKey) return null;
  const hist = stripAccentsUpper(historico);
  if (!hist) return null;

  let best = null;
  let bestLen = -1;
  let bestExact = false;

  for (const item of list(storeKey)) {
    const desc = stripAccentsUpper(item.descricao);
    if (desc.length < 4) continue;
    if (RECEBIMENTO_LOOKUP_KEYS.has(normalizeDescricao(item.descricao))) continue;

    const exact = hist === desc;
    const contained = !exact && containsAsWords(hist, desc);
    if (!exact && !contained) continue;

    const len = desc.length;
    if (
      !best
      || (exact && !bestExact)
      || (exact === bestExact && len > bestLen)
    ) {
      best = item;
      bestLen = len;
      bestExact = exact;
    }
  }

  return best;
}

function findByDescricao(storeKey, descricao) {
  const key = normalizeDescricao(descricao);
  if (!key) return null;
  return list(storeKey).find((item) => normalizeDescricao(item.descricao) === key) || null;
}

/**
 * Recebimento padrao: tenta RECEBIMENTO DE CLIENTES e depois RECEBIMENTO.
 * Retorna { pre, lookupKey } com a chave que bateu (ou a preferida se nenhuma).
 */
function findRecebimentoPadrao(storeKey) {
  const preferred = DESCRICAO_RECEBIMENTO_CLIENTES;
  const aliases = [DESCRICAO_RECEBIMENTO_CLIENTES, CLASSIFICACAO_RECEBIMENTO];
  for (const key of aliases) {
    const pre = findByDescricao(storeKey, key);
    if (pre) return { pre, lookupKey: key };
  }
  return { pre: null, lookupKey: preferred };
}

function create(storeKey, { descricao, debito, credito }) {
  const desc = String(descricao ?? '').trim();
  if (!desc) throw new Error('Descricao e obrigatoria');
  if (findByDescricao(storeKey, desc)) {
    throw new Error(`Ja existe pre-cadastro com descricao exatamente "${desc}"`);
  }
  const doc = readSession(storeKey);
  const item = {
    id: randomUUID(),
    descricao: desc,
    debito: toOptionalNumber(debito),
    credito: toOptionalNumber(credito),
  };
  doc.itens.push(item);
  writeSession(storeKey, doc);
  return item;
}

function update(storeKey, id, { descricao, debito, credito }) {
  const doc = readSession(storeKey);
  const idx = doc.itens.findIndex((i) => i.id === id);
  if (idx < 0) throw new Error('Registro nao encontrado');

  const desc = String(descricao ?? '').trim();
  if (!desc) throw new Error('Descricao e obrigatoria');

  const conflict = doc.itens.find(
    (i) => i.id !== id && normalizeDescricao(i.descricao) === normalizeDescricao(desc),
  );
  if (conflict) {
    throw new Error(`Ja existe pre-cadastro com descricao exatamente "${desc}"`);
  }

  doc.itens[idx] = {
    id,
    descricao: desc,
    debito: toOptionalNumber(debito),
    credito: toOptionalNumber(credito),
  };
  writeSession(storeKey, doc);
  return doc.itens[idx];
}

function remove(storeKey, id) {
  const doc = readSession(storeKey);
  const next = doc.itens.filter((i) => i.id !== id);
  if (next.length === doc.itens.length) throw new Error('Registro nao encontrado');
  doc.itens = next;
  writeSession(storeKey, doc);
  return true;
}

/**
 * Migra JSON anonimo da sessao para o arquivo da empresa se a empresa estiver vazia.
 */
function migrateAnonymousToEmpresa(anonymousSessionId, empresaId) {
  if (!anonymousSessionId || !empresaId) return false;
  const empresaKey = storeKeyForEmpresa(empresaId);
  const empresaDoc = readSession(empresaKey);
  if (empresaDoc.itens.length > 0) return false;

  const anonPath = filePathFor(anonymousSessionId);
  if (!fs.existsSync(anonPath)) return false;
  const anon = JSON.parse(fs.readFileSync(anonPath, 'utf8'));
  const itens = Array.isArray(anon.itens) ? anon.itens : [];
  if (!itens.length) return false;

  writeSession(empresaKey, {
    userId: empresaId,
    itens,
  });
  return true;
}

/**
 * Copia JSON legado empresa-{id}.json para o banco em uso quando o arquivo
 * do banco nao existe ou esta vazio. Nao sobrescreve banco que ja tem itens.
 */
function migrateLegacyEmpresaToBanco(empresaId, bancoId) {
  if (!empresaId || !bancoId) return false;
  const legacyKey = storeKeyForEmpresa(empresaId);
  const bankKey = storeKeyForEmpresaBanco(empresaId, bancoId);
  const bankPath = filePathFor(bankKey);
  const legacyPath = filePathFor(legacyKey);

  if (fs.existsSync(bankPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
      const bankItens = Array.isArray(existing.itens) ? existing.itens : [];
      if (bankItens.length > 0) return false;
    } catch {
      return false;
    }
  }

  if (!fs.existsSync(legacyPath)) return false;
  let itens = [];
  try {
    const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
    itens = Array.isArray(legacy.itens) ? legacy.itens : [];
  } catch {
    return false;
  }
  if (!itens.length) return false;

  writeSession(bankKey, {
    userId: empresaId,
    itens: itens.map((item) => ({ ...item })),
  });
  writeSession(legacyKey, {
    userId: empresaId,
    itens: [],
  });
  return true;
}

function codesFromPre(pre) {
  if (!pre) return { debito: null, credito: null, preCadastroId: null };
  return {
    debito: toOptionalNumber(pre.debito),
    credito: toOptionalNumber(pre.credito),
    preCadastroId: pre.id,
  };
}

function applyPreCadastro(item, storeKey) {
  if (!storeKey) {
    return {
      ...item,
      debito: null,
      credito: null,
    };
  }

  if (item.tipo === 'recebimento') {
    const capRaw = String(item.classificacaoCap || item.categoria || '').trim();
    const isDefaultRecebimento = !capRaw
      || normalizeDescricao(capRaw) === normalizeDescricao(CLASSIFICACAO_RECEBIMENTO);
    let pre;
    let lookupKey;
    if (isDefaultRecebimento) {
      ({ pre, lookupKey } = findRecebimentoPadrao(storeKey));
    } else {
      lookupKey = capRaw;
      pre = findByDescricao(storeKey, lookupKey);
    }
    const codes = codesFromPre(pre);
    const classificacaoCap = isDefaultRecebimento
      ? CLASSIFICACAO_RECEBIMENTO
      : capRaw;
    return {
      ...item,
      classificacaoCap,
      categoria: classificacaoCap,
      debito: codes.debito,
      credito: codes.credito,
      preCadastroId: codes.preCadastroId,
      motivo: pre ? lookupKey : item.motivo || '',
    };
  }

  if (item.status === 'REGRA') {
    const key = item.regraPreCadastro || DESCRICAO_TARIFAS_BANCARIAS;
    const pre = findByDescricao(storeKey, key);
    const codes = codesFromPre(pre);
    return {
      ...item,
      classificacaoCap: item.classificacaoCap || key,
      categoria: item.categoria || key,
      debito: codes.debito,
      credito: codes.credito,
      preCadastroId: codes.preCadastroId,
      aprovado: Boolean(codes.preCadastroId && (codes.debito != null || codes.credito != null)),
      motivo: pre ? key : item.motivo || '',
    };
  }

  const pre = findByDescricao(storeKey, item.classificacaoCap || item.categoria || '');
  const codes = codesFromPre(pre);
  if (!pre) {
    return {
      ...item,
      debito: null,
      credito: null,
      preCadastroId: null,
      aprovado: false,
    };
  }
  return {
    ...item,
    debito: codes.debito,
    credito: codes.credito,
    preCadastroId: codes.preCadastroId,
    aprovado: item.status === 'MATCHED' && (codes.debito != null || codes.credito != null),
  };
}

module.exports = {
  getDataDir,
  SEED_PATH,
  DESCRICAO_RECEBIMENTO_CLIENTES,
  CLASSIFICACAO_RECEBIMENTO,
  DESCRICAO_TARIFAS_BANCARIAS,
  storeKeyForEmpresa,
  storeKeyForEmpresaBanco,
  resolveStoreKey,
  legacyKeyFromBankStoreKey,
  toOptionalNumber,
  readSession,
  list,
  findByDescricao,
  findBestPreByHistorico,
  create,
  update,
  remove,
  migrateAnonymousToEmpresa,
  migrateLegacyEmpresaToBanco,
  applyPreCadastro,
};

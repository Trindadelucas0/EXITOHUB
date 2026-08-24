'use strict';

const { money, parseDate, digits } = require('../utils');
const { readWorkbook, sheetToMatrix } = require('./xlsxHelper');
const {
  MSG_SEM_DADOS,
  validateMap,
  validateLancamento,
  assertHasLancamentos,
} = require('./extratoValidate');
const { isGeminiEnabled, suggestExtratoMap } = require('../geminiExtratoMap');

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeHeader(cell) {
  return stripAccents(String(cell ?? '').trim().toLowerCase())
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[$]/g, '')
    .trim();
}

const DATA_SYNONYMS = [
  'data',
  'data lancamento',
  'data do lancamento',
  'dt',
  'data movimento',
  'release date',
  'release_date',
];
const HIST_SYNONYMS = [
  'historico',
  'lancamento',
  'descricao',
  'descricao do lancamento',
  'memo',
  'historico do lancamento',
  'transaction type',
  'transaction_type',
];
const VALOR_SYNONYMS = [
  'valor',
  'valor r$',
  'valor rs',
  'amount',
  'vlr',
  'transaction net amount',
  'transaction_net_amount',
  'net amount',
];
const DEBITO_SYNONYMS = ['debito', 'saida', 'valor debito', 'vlr debito'];
const CREDITO_SYNONYMS = ['credito', 'entrada', 'valor credito', 'vlr credito'];
/** Tipo D/C — inclui movimentacao (Stone: Debito/Credito) */
const TIPO_DC_SYNONYMS = ['movimentacao', 'd/c', 'c/d', 'natureza', 'tipo lancamento', 'dc', 'inf', 'inf.'];
const TIPO_PIX_SYNONYMS = ['tipo'];
const RAZAO_SYNONYMS = ['razao social', 'nome', 'favorecido', 'beneficiario'];
const CNPJ_SYNONYMS = ['cnpj', 'cpf/cnpj', 'cpf cnpj', 'documento'];
const DESTINO_SYNONYMS = ['destino'];
const ORIGEM_SYNONYMS = ['origem'];
const DESTINO_DOC_SYNONYMS = ['destino documento', 'destino doc'];
const ORIGEM_DOC_SYNONYMS = ['origem documento', 'origem doc'];
/** BB: Detalhamento Hist. (complemento do Historico) */
const DETALHAMENTO_SYNONYMS = [
  'detalhamento',
  'detalhamento hist',
  'detalhamento hist.',
  'detalhamento historico',
  'detalhamento do hist',
  'detalhamento do historico',
];

function matchesSynonym(normalized, synonyms) {
  if (!normalized) return false;
  return synonyms.some((syn) => {
    const s = normalizeHeader(syn);
    if (!s) return false;
    if (normalized === s) return true;
    if (normalized.startsWith(`${s} `) || normalized.startsWith(`${s}(`)) return true;
    return false;
  });
}

function findColumnIndex(headers, synonyms, used) {
  for (let i = 0; i < headers.length; i += 1) {
    if (used.has(i)) continue;
    if (matchesSynonym(headers[i], synonyms)) return i;
  }
  return -1;
}

function emptyExtra() {
  return {
    destinoIdx: -1,
    origemIdx: -1,
    destinoDocIdx: -1,
    origemDocIdx: -1,
    detalhamentoIdx: -1,
    layout: null,
  };
}

/**
 * Completa detalhamentoIdx a partir do cabecalho quando o mapa (ex.: Gemini) nao trouxe a coluna.
 */
function enrichDetalhamentoIdx(rows, map) {
  if (!map || (map.detalhamentoIdx != null && map.detalhamentoIdx >= 0)) return map;
  const headerIdx = map.headerIdx >= 0 ? map.headerIdx : (map.headerRow >= 0 ? map.headerRow : 0);
  const headers = (rows[headerIdx] || []).map(normalizeHeader);
  const used = new Set(
    [
      map.dataIdx,
      map.histIdx,
      map.valorIdx,
      map.debitoIdx,
      map.creditoIdx,
      map.tipoIdx,
      map.razaoIdx,
      map.cnpjIdx,
    ].filter((i) => i != null && i >= 0),
  );
  const detalhamentoIdx = findColumnIndex(headers, DETALHAMENTO_SYNONYMS, used);
  return { ...map, detalhamentoIdx };
}

/**
 * Mercado Pago: RELEASE_DATE + TRANSACTION_TYPE + TRANSACTION_NET_AMOUNT
 */
function tryMercadoPagoMap(headers, headerIdx) {
  const used = new Set();
  const dataIdx = findColumnIndex(headers, ['release date', 'release_date'], used);
  if (dataIdx < 0) return null;
  used.add(dataIdx);
  const histIdx = findColumnIndex(headers, ['transaction type', 'transaction_type'], used);
  if (histIdx < 0) return null;
  used.add(histIdx);
  const valorIdx = findColumnIndex(
    headers,
    ['transaction net amount', 'transaction_net_amount', 'net amount'],
    used,
  );
  if (valorIdx < 0) return null;

  return {
    score: 10,
    headerIdx,
    headersFound: headers.filter(Boolean),
    map: {
      dataIdx,
      histIdx,
      valorIdx,
      debitoIdx: -1,
      creditoIdx: -1,
      tipoIdx: -1,
      razaoIdx: -1,
      cnpjIdx: -1,
      headerIdx,
      ...emptyExtra(),
      layout: 'mercado_pago',
    },
  };
}

/**
 * Stone/Pix: Movimentacao (D/C) + Tipo + Valor + Data + Destino/Origem
 */
function tryStoneMap(headers, headerIdx) {
  const used = new Set();
  const dataIdx = findColumnIndex(headers, DATA_SYNONYMS, used);
  if (dataIdx < 0) return null;
  used.add(dataIdx);

  const movIdx = findColumnIndex(headers, ['movimentacao'], used);
  if (movIdx < 0) return null;
  used.add(movIdx);

  const valorIdx = findColumnIndex(headers, VALOR_SYNONYMS, used);
  if (valorIdx < 0) return null;
  used.add(valorIdx);

  const tipoPixIdx = findColumnIndex(headers, TIPO_PIX_SYNONYMS, used);
  if (tipoPixIdx >= 0) used.add(tipoPixIdx);

  const destinoIdx = findColumnIndex(headers, DESTINO_SYNONYMS, used);
  if (destinoIdx >= 0) used.add(destinoIdx);
  const origemIdx = findColumnIndex(headers, ORIGEM_SYNONYMS, used);
  if (origemIdx >= 0) used.add(origemIdx);
  if (destinoIdx < 0 && origemIdx < 0) return null;

  const destinoDocIdx = findColumnIndex(headers, DESTINO_DOC_SYNONYMS, used);
  if (destinoDocIdx >= 0) used.add(destinoDocIdx);
  const origemDocIdx = findColumnIndex(headers, ORIGEM_DOC_SYNONYMS, used);

  // Historico base = Tipo (Pix); se nao houver, usa Movimentacao
  const histIdx = tipoPixIdx >= 0 ? tipoPixIdx : movIdx;

  return {
    score: 10,
    headerIdx,
    headersFound: headers.filter(Boolean),
    map: {
      dataIdx,
      histIdx,
      valorIdx,
      debitoIdx: -1,
      creditoIdx: -1,
      tipoIdx: movIdx,
      razaoIdx: -1,
      cnpjIdx: -1,
      headerIdx,
      destinoIdx,
      origemIdx,
      destinoDocIdx,
      origemDocIdx,
      layout: 'stone',
    },
  };
}

function findHeaderAndMap(rows) {
  let best = null;

  for (let r = 0; r < Math.min(rows.length, 40); r += 1) {
    const headers = (rows[r] || []).map(normalizeHeader);
    if (!headers.some(Boolean)) continue;

    // Pular resumo Mercado Pago
    const joined = headers.join('|');
    if (joined.includes('initial balance') || joined.includes('final balance')) {
      continue;
    }

    const mp = tryMercadoPagoMap(headers, r);
    if (mp && (!best || mp.score > best.score)) best = mp;

    const stone = tryStoneMap(headers, r);
    if (stone && (!best || stone.score > best.score)) best = stone;

    const used = new Set();
    const dataIdx = findColumnIndex(headers, DATA_SYNONYMS, used);
    if (dataIdx >= 0) used.add(dataIdx);
    const histIdx = findColumnIndex(headers, HIST_SYNONYMS, used);
    if (histIdx >= 0) used.add(histIdx);

    const debitoIdx = findColumnIndex(headers, DEBITO_SYNONYMS, used);
    if (debitoIdx >= 0) used.add(debitoIdx);
    const creditoIdx = findColumnIndex(headers, CREDITO_SYNONYMS, used);
    if (creditoIdx >= 0) used.add(creditoIdx);

    let valorIdx = -1;
    let tipoIdx = -1;
    if (debitoIdx < 0 && creditoIdx < 0) {
      valorIdx = findColumnIndex(headers, VALOR_SYNONYMS, used);
      if (valorIdx >= 0) used.add(valorIdx);
      tipoIdx = findColumnIndex(headers, [...TIPO_DC_SYNONYMS, ...TIPO_PIX_SYNONYMS], used);
      if (tipoIdx >= 0) used.add(tipoIdx);
    }

    const razaoIdx = findColumnIndex(headers, RAZAO_SYNONYMS, used);
    if (razaoIdx >= 0) used.add(razaoIdx);
    const cnpjIdx = findColumnIndex(headers, CNPJ_SYNONYMS, used);
    if (cnpjIdx >= 0) used.add(cnpjIdx);
    const detalhamentoIdx = findColumnIndex(headers, DETALHAMENTO_SYNONYMS, used);

    const hasValorMode = valorIdx >= 0;
    const hasDebCredMode = debitoIdx >= 0 || creditoIdx >= 0;
    const score = (dataIdx >= 0 ? 2 : 0)
      + (histIdx >= 0 ? 2 : 0)
      + (hasValorMode || hasDebCredMode ? 2 : 0)
      + (tipoIdx >= 0 ? 1 : 0);

    if (score < 4) continue;

    if (!best || score > best.score) {
      best = {
        score,
        headerIdx: r,
        headersFound: headers.filter(Boolean),
        map: {
          dataIdx,
          histIdx,
          valorIdx,
          debitoIdx,
          creditoIdx,
          tipoIdx,
          razaoIdx,
          cnpjIdx,
          headerIdx: r,
          ...emptyExtra(),
          detalhamentoIdx,
          layout: 'generic',
        },
      };
    }
  }

  return best;
}

function isSaidaTipo(raw) {
  const t = normalizeHeader(raw);
  if (!t) return null;
  if (t === 'd' || t === 'debito' || t === 'saida' || t.startsWith('deb') || t.includes('saida')) {
    return true;
  }
  if (t === 'c' || t === 'credito' || t === 'entrada' || t.startsWith('cred') || t.includes('entrada')) {
    return false;
  }
  return null;
}

/**
 * Quando o banco exporta valor sempre positivo (sem sinal / sem coluna D/C),
 * o historico costuma indicar saida vs entrada.
 * @returns {boolean|null} true=saida(pagamento), false=entrada(recebimento)
 */
function inferSaidaFromHistorico(historico) {
  const h = stripAccents(String(historico || '')).toUpperCase();
  if (!h) return null;

  if (
    /PIX RECEBID|TED RECEBID|DOC RECEBID|BOLETO RECEBID|DEPOSITO|RES APLIC|RENDIMENTO|RECEBIMENTO|TRANSF RECEBID|CREDITO RECEBID|ESTORNO DE CREDITO|PIX QR CODE RECEBID|DINHEIRO RECEBID|LIBERACAO DE DINHEIRO|REEMBOLSO/.test(h)
  ) {
    return false;
  }
  if (
    /PIX ENVIAD|TED ENVIAD|DOC ENVIAD|BOLETO PAGO|PAGAMENTO|SISPAG|^TAR\/|TARIF|CUSTAS|DEBITO AUTOM|SAQUE|PAGTO|ENVIO PIX|TRIBUTO|DARF|FGTS|DEBITO POR DIVIDA/.test(h)
    && !/RECEBID/.test(h)
  ) {
    return true;
  }
  if (/\bPAGO\b|\bPAGAMENTO\b|\bDEBITO\b|\bSAIDA\b/.test(h)) return true;
  if (/\bCREDITO\b|\bENTRADA\b|\bRECEBIDO\b/.test(h)) return false;
  return null;
}

function tipoFromValorCell(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(/(?:^|\s)([DdCc])(?:\s|$)/) || s.match(/([DdCc])\s*$/);
  if (!m) return null;
  return m[1].toUpperCase() === 'D';
}

function resolveSignedValor(row, map) {
  const { valorIdx, debitoIdx, creditoIdx, tipoIdx, histIdx } = map;

  if (debitoIdx >= 0 || creditoIdx >= 0) {
    const deb = debitoIdx >= 0 ? money(row[debitoIdx]) : null;
    const cred = creditoIdx >= 0 ? money(row[creditoIdx]) : null;
    if (deb !== null && Math.abs(deb) > 0) return -Math.abs(deb);
    if (cred !== null && Math.abs(cred) > 0) return Math.abs(cred);
    return null;
  }

  if (valorIdx < 0) return null;
  const cell = row[valorIdx];
  const v = money(cell);
  if (v === null) return null;

  // Mercado Pago: TRANSACTION_NET_AMOUNT ja vem com o sinal correto do impacto
  // no saldo (SETTLEMENT/Pagamento = +, REFUND/Reembolso/WITHDRAWAL = -).
  // Nao usar a heuristica de historico (feita para extrato bancario), pois
  // ela interpreta "Pagamento" como saida e "Reembolso" como entrada,
  // invertendo o sinal que o proprio Mercado Pago ja informou.
  if (map.layout === 'mercado_pago') return v;

  if (tipoIdx >= 0) {
    const saida = isSaidaTipo(row[tipoIdx]);
    if (saida === true) return -Math.abs(v);
    if (saida === false) return Math.abs(v);
  }

  const saidaCell = tipoFromValorCell(cell);
  if (saidaCell === true) return -Math.abs(v);
  if (saidaCell === false) return Math.abs(v);

  const historico = histIdx >= 0 ? row[histIdx] : '';
  const saidaHist = inferSaidaFromHistorico(historico);
  if (saidaHist === true) return -Math.abs(v);
  if (saidaHist === false) return Math.abs(v);

  return v;
}

function cellStr(row, idx) {
  if (idx == null || idx < 0) return '';
  return String(row[idx] ?? '').trim();
}

function buildHistoricoAndParty(row, map, valor) {
  let historico = cellStr(row, map.histIdx);
  let razaoSocial = map.razaoIdx >= 0 ? cellStr(row, map.razaoIdx) : '';
  let cnpj = map.cnpjIdx >= 0 ? digits(row[map.cnpjIdx]) : '';

  if (map.layout === 'stone') {
    const saida = map.tipoIdx >= 0 ? isSaidaTipo(row[map.tipoIdx]) : (valor < 0);
    const nome = saida === false
      ? cellStr(row, map.origemIdx)
      : cellStr(row, map.destinoIdx);
    const doc = saida === false
      ? cellStr(row, map.origemDocIdx)
      : cellStr(row, map.destinoDocIdx);
    const mov = map.tipoIdx >= 0 ? cellStr(row, map.tipoIdx) : '';
    const parts = [historico, mov, nome].filter(Boolean);
    // evita "Pix — Debito — Nome" duplicado se histIdx === tipoPix
    historico = [...new Set(parts)].join(' — ');
    if (nome) razaoSocial = nome;
    if (doc) cnpj = digits(doc);
  }

  const detalhe = cellStr(row, map.detalhamentoIdx);
  if (historico && detalhe) {
    historico = `${historico} - ${detalhe}`;
  }

  return { historico, razaoSocial, cnpj };
}

function rowToLancamento(row, map, id) {
  const valor = resolveSignedValor(row, map);
  if (valor === null || valor === 0) return null;

  const { historico, razaoSocial, cnpj } = buildHistoricoAndParty(row, map, valor);
  if (!historico) return null;
  if (historico.toUpperCase().startsWith('SALDO')) return null;
  if (/^INITIAL_BALANCE$/i.test(historico)) return null;

  const data = parseDate(row[map.dataIdx]);
  if (!data) return null;

  const item = {
    id,
    data,
    historico,
    razaoSocial,
    cnpj,
    valor,
  };
  return validateLancamento(item) ? item : null;
}

function buildResult(lancamentos, meta) {
  assertHasLancamentos(lancamentos);
  return {
    lancamentos,
    pagamentos: lancamentos.filter((l) => l.valor < 0),
    recebimentos: lancamentos.filter((l) => l.valor > 0),
    _meta: meta || null,
  };
}

/**
 * Parse com mapa ja validado.
 */
function parseExtratoWithMap(rows, map) {
  const enriched = enrichDetalhamentoIdx(rows, map);
  const checked = validateMap(rows, {
    ...enriched,
    headerRow: enriched.headerIdx ?? enriched.headerRow ?? 0,
  });
  if (!checked.ok) {
    throw new Error(checked.error || MSG_SEM_DADOS);
  }
  const m = enrichDetalhamentoIdx(rows, { ...enriched, ...checked.map });
  const headerIdx = m.headerIdx;
  const lancamentos = [];
  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const item = rowToLancamento(rows[i] || [], m, `ext-${lancamentos.length}`);
    if (item) lancamentos.push(item);
  }
  return buildResult(lancamentos, { source: 'map', map: m });
}

/**
 * Parse por sinonimos de cabecalho (fallback).
 */
function parseExtratoMatrix(rows) {
  const found = findHeaderAndMap(rows);
  if (!found) {
    const sample = (rows[0] || []).map((c) => String(c ?? '').trim()).filter(Boolean).slice(0, 8);
    throw new Error(
      `${MSG_SEM_DADOS} Encontrado no inicio: [${sample.join(', ') || 'vazio'}]`,
    );
  }

  const { map, headerIdx, headersFound } = found;
  const missing = [];
  if (map.dataIdx < 0) missing.push('Data');
  if (map.histIdx < 0) missing.push('Historico');
  const hasValor = map.valorIdx >= 0 || map.debitoIdx >= 0 || map.creditoIdx >= 0;
  if (!hasValor) missing.push('Valor (ou Debito/Credito)');
  if (missing.length) {
    throw new Error(
      `Extrato incompleto: faltam colunas ${missing.join(', ')}. `
      + `Cabecalhos detectados: [${headersFound.join(', ')}]`,
    );
  }

  const checked = validateMap(rows, { ...map, headerRow: headerIdx });
  if (!checked.ok) {
    throw new Error(checked.error || MSG_SEM_DADOS);
  }

  const m = enrichDetalhamentoIdx(rows, { ...map, ...checked.map });
  const lancamentos = [];
  for (let i = m.headerIdx + 1; i < rows.length; i += 1) {
    const item = rowToLancamento(rows[i] || [], m, `ext-${lancamentos.length}`);
    if (item) lancamentos.push(item);
  }
  return buildResult(lancamentos, { source: 'synonyms', map: m, headersFound });
}

/**
 * Gemini (se key) -> validacao regex -> parse; fallback sinonimos.
 * @param {object} [opts]
 * @param {(patch:{percent?:number,step?:string})=>void} [opts.onProgress]
 */
async function parseExtratoSmart(bufferOrPath, opts = {}) {
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : () => {};
  const workbook = readWorkbook(bufferOrPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = sheetToMatrix(sheet);

  let usedGemini = false;
  let aiWarning = null;

  if (isGeminiEnabled()) {
    onProgress({ percent: 40, step: 'Aguardando fila da IA (intervalo anti-cota)…' });
    try {
      onProgress({ percent: 55, step: 'Gemini mapeando colunas do extrato…' });
      const aiRaw = await suggestExtratoMap(rows);
      usedGemini = true;
      onProgress({ percent: 65, step: 'Validando colunas e dados…' });
      const checked = validateMap(rows, aiRaw);
      if (checked.ok) {
        const result = parseExtratoWithMap(rows, checked.map);
        return {
          lancamentos: result.lancamentos,
          pagamentos: result.pagamentos,
          recebimentos: result.recebimentos,
          usedGemini: true,
          aiWarning: null,
        };
      }
      aiWarning = checked.error || 'Mapa da IA rejeitado pela validacao; usando deteccao por nomes.';
      onProgress({ percent: 65, step: aiWarning });
    } catch (err) {
      aiWarning = err.message || 'Gemini falhou; usando deteccao por nomes.';
      console.warn('[extrato]', aiWarning);
      onProgress({ percent: 62, step: 'IA indisponivel — usando fallback por colunas…' });
    }
  }

  onProgress({ percent: 65, step: 'Validando colunas e dados…' });
  try {
    const result = parseExtratoMatrix(rows);
    return {
      lancamentos: result.lancamentos,
      pagamentos: result.pagamentos,
      recebimentos: result.recebimentos,
      usedGemini,
      aiWarning,
    };
  } catch (err) {
    throw new Error(err.message || MSG_SEM_DADOS);
  }
}

function parseExtrato(bufferOrPath) {
  const workbook = readWorkbook(bufferOrPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = sheetToMatrix(sheet);
  const result = parseExtratoMatrix(rows);
  return {
    lancamentos: result.lancamentos,
    pagamentos: result.pagamentos,
    recebimentos: result.recebimentos,
  };
}

module.exports = {
  parseExtrato,
  parseExtratoSmart,
  parseExtratoMatrix,
  parseExtratoWithMap,
  normalizeHeader,
  resolveSignedValor,
  inferSaidaFromHistorico,
  findHeaderAndMap,
};

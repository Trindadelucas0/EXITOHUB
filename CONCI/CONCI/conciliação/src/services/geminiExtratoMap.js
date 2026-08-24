'use strict';

const { enqueueAi, withRetry } = require('./aiQueue');

function isGeminiEnabled() {
  return Boolean(String(process.env.GEMINI_API_KEY || '').trim());
}

/**
 * Amostra pequena de proposito: menos tokens = menos risco de estourar cota free.
 */
function buildSamplePayload(rows) {
  const preview = [];
  const limit = Math.min(rows.length, 12);
  for (let i = 0; i < limit; i += 1) {
    const row = (rows[i] || []).slice(0, 10).map((c) => {
      if (c === null || c === undefined) return '';
      if (c instanceof Date) return c.toISOString().slice(0, 10);
      const s = String(c).trim();
      return s.length > 48 ? `${s.slice(0, 48)}…` : s;
    });
    if (row.some((c) => c !== '')) {
      preview.push({ rowIndex: i, cells: row });
    }
  }
  return preview;
}

function extractJson(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Resposta Gemini sem JSON');
  return JSON.parse(body.slice(start, end + 1));
}

function friendlyGeminiError(status, msg) {
  const m = String(msg || '');
  if (status === 403 || /permission|PERMISSION_DENIED/i.test(m)) {
    return (
      'Gemini sem permissao (403). Crie uma chave nova em https://aistudio.google.com/apikey '
      + 'e cole em GEMINI_API_KEY no .env (reinicie o servidor).'
    );
  }
  if (status === 400 && /API key|API_KEY_INVALID/i.test(m)) {
    return 'GEMINI_API_KEY invalida. Gere outra em AI Studio e atualize o .env.';
  }
  if (status === 429 || /quota|rate|RESOURCE_EXHAUSTED|limit:\s*0/i.test(m)) {
    return (
      'Gemini rate limit/cota. Espere alguns minutos antes de outro upload. '
      + 'O sistema usara deteccao por nomes. Detalhe: '
      + m.slice(0, 160)
    );
  }
  if (status === 404 || /not found|model/i.test(m)) {
    return `Modelo Gemini nao encontrado. Ajuste GEMINI_MODEL no .env (ex.: gemini-2.0-flash). Detalhe: ${m}`;
  }
  return `Gemini: ${m}`;
}

async function callGeminiApi(prompt) {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
        responseMimeType: 'application/json',
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText || 'erro Gemini';
    const err = new Error(friendlyGeminiError(res.status, msg));
    err.status = res.status;
    err.rawMessage = msg;
    throw err;
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return extractJson(text);
}

/**
 * Pede ao Gemini o mapa de colunas do extrato (1 chamada pequena por upload).
 */
async function suggestExtratoMap(rows) {
  if (!isGeminiEnabled()) return null;

  const sample = buildSamplePayload(rows);
  const prompt = `Analise extrato bancario (amostra pequena). Identifique cabecalho e indices 0-based.

Retorne APENAS JSON:
{"headerRow":0,"dataCol":0,"historicoCol":1,"valorCol":4,"debitoCol":null,"creditoCol":null,"tipoCol":null,"detalhamentoCol":null}

Regras: dataCol=data; historicoCol=descricao (nao use Detalhamento Hist como historicoCol); detalhamentoCol=Detalhamento Hist se existir; valorCol OU debitoCol/creditoCol; tipoCol so se D/C; null se nao existir; nao invente indices.

Amostra:
${JSON.stringify(sample)}`;

  return enqueueAi(() => withRetry(() => callGeminiApi(prompt)));
}

module.exports = {
  isGeminiEnabled,
  suggestExtratoMap,
  buildSamplePayload,
  extractJson,
  friendlyGeminiError,
};

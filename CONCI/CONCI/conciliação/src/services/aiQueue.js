'use strict';

/**
 * Fila conservadora para IA (conta nova / free tier):
 * - 1 chamada por vez
 * - intervalo minimo longo entre chamadas
 * - retry so em 429 transitório (nao em cota zerada)
 */

let chain = Promise.resolve();
let lastCallAt = 0;
let inFlight = 0;
let callsThisHour = 0;
let hourWindowStart = Date.now();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMaxConcurrent() {
  return Math.max(1, Number(process.env.GEMINI_MAX_CONCURRENT || 1));
}

function getMinIntervalMs() {
  return Math.max(0, Number(process.env.GEMINI_MIN_INTERVAL_MS || 12000));
}

function getMaxCallsPerHour() {
  return Math.max(1, Number(process.env.GEMINI_MAX_CALLS_PER_HOUR || 8));
}

function assertWithinHourlyBudget() {
  const now = Date.now();
  if (now - hourWindowStart >= 60 * 60 * 1000) {
    hourWindowStart = now;
    callsThisHour = 0;
  }
  if (callsThisHour >= getMaxCallsPerHour()) {
    const err = new Error(
      `Limite local de ${getMaxCallsPerHour()} chamadas Gemini/hora atingido `
      + '(protecao para nao esgotar cota). Usando deteccao por nomes.',
    );
    err.code = 'AI_BUDGET';
    throw err;
  }
  callsThisHour += 1;
}

/**
 * Executa fn sob a fila. fn deve retornar Promise.
 */
function enqueueAi(fn) {
  const run = async () => {
    while (inFlight >= getMaxConcurrent()) {
      await sleep(150);
    }
    const wait = getMinIntervalMs() - (Date.now() - lastCallAt);
    if (wait > 0) await sleep(wait);

    assertWithinHourlyBudget();

    inFlight += 1;
    lastCallAt = Date.now();
    try {
      return await fn();
    } finally {
      inFlight -= 1;
    }
  };

  const result = chain.then(run, run);
  chain = result.then(() => undefined, () => undefined);
  return result;
}

function isQuotaExhausted(msg, status) {
  return (
    /limit:\s*0|quota|RESOURCE_EXHAUSTED|exceeded your current quota|billing/i.test(msg)
    && !/high demand|try again later/i.test(msg)
  ) || (status === 429 && /limit:\s*0|quota/i.test(msg));
}

/**
 * Retry minimo: nao re-tenta cota zerada (gastaria a fila a toa).
 * Em 429/overload transitório, espera bastante e tenta poucas vezes.
 */
async function withRetry(fn, { maxAttempts } = {}) {
  const attempts = Math.max(1, Number(
    maxAttempts ?? process.env.GEMINI_RETRY_MAX ?? 1,
  ));
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err.message || err);
      const status = err.status || err.statusCode;
      if (isQuotaExhausted(msg, status) || err.code === 'AI_BUDGET') throw err;
      const retriable = status === 429 || /429|rate|overload|high demand|RESOURCE_EXHAUSTED/i.test(msg);
      if (!retriable || attempt === attempts) throw err;
      // backoff longo para conta nova (15s, 30s…)
      await sleep(15000 * attempt);
    }
  }
  throw lastErr;
}

module.exports = {
  enqueueAi,
  withRetry,
  sleep,
  assertWithinHourlyBudget,
};

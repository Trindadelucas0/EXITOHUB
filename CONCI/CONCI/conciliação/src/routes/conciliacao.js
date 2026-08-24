'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { parseExtratoSmart } = require('../services/parsers/extrato');
const { parseContasPagar } = require('../services/parsers/contasPagar');
const { runMatching } = require('../services/matching/orchestrator');
const {
  createSession,
  getSession,
  putSession,
  updateSession,
  deleteSession,
} = require('../services/sessionStore');
const conciliacaoStore = require('../services/conciliacaoStore');
const { exportDominio, exportDominioTxt } = require('../services/exportDominio');
const { exportRelatorioExcel, exportRelatorioPdf } = require('../services/exportRelatorio');
const {
  applyColumnFilters,
  applyColumnSort,
  pickColumnFilters,
  columnFiltersQuery,
} = require('../services/columnFilters');
const { requireEmpresa } = require('../middleware/session');
const {
  resolveStoreKey,
  migrateLegacyEmpresaToBanco,
  applyPreCadastro,
  list: listPreCadastro,
} = require('../services/preCadastroStore');
const { listBancos, getBancoById } = require('../services/bancoService');
const { createJob, updateJob, getJob, publicJob } = require('../services/jobStore');
const { isGeminiEnabled } = require('../services/geminiExtratoMap');
const {
  excludeItems,
  reapplyPreCadastroItems,
  applyCapLote,
  applyCapAndPre,
} = require('../services/revisaoBulk');

const router = express.Router();

function sessionPreKey(session) {
  if (!session) return null;
  return resolveStoreKey(session.empresaId, session.bancoId);
}

function capSugestoesForSession(session) {
  const key = sessionPreKey(session);
  if (!key) return [];
  return listPreCadastro(key)
    .map((i) => String(i.descricao || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function redirectRevisao(res, sessionId, body, extra = {}) {
  const colFilters = pickColumnFilters(body || {});
  const qs = buildFilterQuery((body && body.filtro) || 'todos', colFilters, extra);
  return res.redirect(`/revisao/${sessionId}${qs}`);
}

router.use(requireEmpresa);

async function loadUploadLocals(error = null) {
  const bancos = await listBancos({ onlyAtivos: true }).catch(() => []);
  return {
    error,
    geminiEnabled: isGeminiEnabled(),
    bancos,
    currentNav: 'upload',
  };
}

/**
 * Sessão em memória ou reidratada do Postgres (escopo da empresa).
 */
async function resolveSession(id, empresaId) {
  let session = getSession(id);
  if (session) {
    if (session.empresaId && session.empresaId !== empresaId) return null;
    return session;
  }
  const fromDb = await conciliacaoStore.getById(id, empresaId);
  if (!fromDb) return null;
  return putSession(fromDb);
}

async function persistSessionUpdate(sessionId, patch) {
  const next = updateSession(sessionId, patch);
  if (next) {
    try {
      await conciliacaoStore.update(sessionId, {
        itens: next.itens,
        resumo: next.resumo,
      });
    } catch (err) {
      console.error('[conciliacao] falha ao persistir update:', err.message);
    }
  }
  return next;
}

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
});

function buildResumo(itens) {
  return {
    total: itens.length,
    pagamentos: itens.filter((i) => i.tipo === 'pagamento').length,
    recebimentos: itens.filter((i) => i.tipo === 'recebimento').length,
    matched: itens.filter((i) => i.status === 'MATCHED').length,
    sugerido: itens.filter((i) => i.status === 'SUGERIDO' && !i.aprovado).length,
    regra: itens.filter((i) => i.status === 'REGRA').length,
    semMatch: itens.filter((i) => i.status === 'SEM_MATCH').length,
    comClassificacao: itens.filter((i) => i.classificacaoCap).length,
    comNota: itens.filter((i) => i.numeroNota).length,
    aprovados: itens.filter((i) => i.aprovado).length,
    pendentes: itens.filter((i) => !i.aprovado).length,
  };
}

function filterItens(itens, filtro) {
  switch (filtro) {
    case 'pagamentos':
      return itens.filter((i) => i.tipo === 'pagamento');
    case 'recebimentos':
      return itens.filter((i) => i.tipo === 'recebimento');
    case 'com-classificacao':
      return itens.filter((i) => i.classificacaoCap);
    case 'sem-classificacao':
      return itens.filter((i) => i.tipo === 'pagamento' && !i.classificacaoCap);
    case 'sugerido':
      return itens.filter((i) => i.status === 'SUGERIDO' && !i.aprovado);
    case 'aprovados':
      return itens.filter((i) => i.aprovado);
    case 'pendentes':
      return itens.filter((i) => !i.aprovado);
    default:
      return itens;
  }
}

function buildFilterQuery(filtro, colFilters, extra = {}) {
  const params = new URLSearchParams();
  if (filtro && filtro !== 'todos') params.set('filtro', filtro);
  const col = columnFiltersQuery(colFilters);
  if (col) {
    col.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k && v) params.set(k, decodeURIComponent(v));
    });
  }
  Object.entries(extra || {}).forEach(([k, v]) => {
    if (v != null && v !== '') params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : '';
}

function slugFilePart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'arquivo';
}

function timestampFilePart(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function relatorioFileName(session, ext) {
  const banco = slugFilePart(session.bancoNome);
  const competencia = slugFilePart(
    conciliacaoStore.formatCompetencia(session.competencia) || session.competencia,
  );
  return `Conciliacao_${banco}_${competencia}_${timestampFilePart()}.${ext}`;
}

function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
}

function formatDateTimeBr(isoOrDate) {
  if (!isoOrDate) return '';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

router.get('/', async (req, res) => {
  res.render('upload', await loadUploadLocals(null));
});

router.get('/historico', async (req, res) => {
  const filters = {
    competencia: String(req.query.competencia || '').trim(),
    de: String(req.query.de || '').trim(),
    ate: String(req.query.ate || '').trim(),
  };
  let lista = [];
  let error = null;
  try {
    lista = await conciliacaoStore.listByEmpresa(req.user.empresaId, filters);
  } catch (err) {
    console.error(err);
    error = err.message || 'Erro ao carregar historico';
  }
  res.render('historico', {
    lista,
    filters,
    error,
    success: req.query.ok || null,
    queryErro: req.query.erro || null,
    formatDateTimeBr,
    formatCompetencia: conciliacaoStore.formatCompetencia,
    currentNav: 'historico',
  });
});

router.post('/historico/:id/excluir', express.urlencoded({ extended: true }), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const qs = new URLSearchParams();
  const competencia = String(req.body.competencia || req.query.competencia || '').trim();
  const de = String(req.body.de || req.query.de || '').trim();
  const ate = String(req.body.ate || req.query.ate || '').trim();
  if (competencia) qs.set('competencia', competencia);
  if (de) qs.set('de', de);
  if (ate) qs.set('ate', ate);

  try {
    const atual = await conciliacaoStore.getById(id, req.user.empresaId);
    if (atual && atual.enviado) {
      qs.set('erro', 'enviado');
      return res.redirect(`/historico?${qs.toString()}`);
    }
    const removed = await conciliacaoStore.removeById(id, req.user.empresaId);
    if (!removed) {
      qs.set('erro', 'nao-encontrada');
      return res.redirect(`/historico?${qs.toString()}`);
    }
    deleteSession(id);
    qs.set('ok', 'excluido');
    return res.redirect(`/historico?${qs.toString()}`);
  } catch (err) {
    console.error(err);
    qs.set('erro', 'falha');
    return res.redirect(`/historico?${qs.toString()}`);
  }
});

router.post('/historico/:id/marcar-enviado', express.urlencoded({ extended: true }), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const qs = new URLSearchParams();
  const competencia = String(req.body.competencia || '').trim();
  const de = String(req.body.de || '').trim();
  const ate = String(req.body.ate || '').trim();
  if (competencia) qs.set('competencia', competencia);
  if (de) qs.set('de', de);
  if (ate) qs.set('ate', ate);

  try {
    const updated = await conciliacaoStore.marcarEnviado(id, req.user.empresaId);
    if (!updated) {
      qs.set('erro', 'nao-encontrada');
      return res.redirect(`/historico?${qs.toString()}`);
    }
    updateSession(id, {
      enviado: updated.enviado,
      enviadoEm: updated.enviadoEm,
    });
    qs.set('ok', 'enviado');
    return res.redirect(`/historico?${qs.toString()}`);
  } catch (err) {
    console.error(err);
    qs.set('erro', 'falha');
    return res.redirect(`/historico?${qs.toString()}`);
  }
});

router.post('/historico/:id/desbloquear', express.urlencoded({ extended: true }), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const motivo = String(req.body.motivo || '').trim();
  const origem = req.body.origem === 'revisao' ? 'revisao' : 'historico';
  const qs = new URLSearchParams();
  const competencia = String(req.body.competencia || '').trim();
  const de = String(req.body.de || '').trim();
  const ate = String(req.body.ate || '').trim();
  if (competencia) qs.set('competencia', competencia);
  if (de) qs.set('de', de);
  if (ate) qs.set('ate', ate);

  function voltar(erro) {
    if (origem === 'revisao') {
      return res.redirect(`/revisao/${id}${erro ? `?erro=${erro}` : ''}`);
    }
    if (erro) qs.set('erro', erro);
    return res.redirect(`/historico?${qs.toString()}`);
  }

  if (motivo.length < 3) {
    return voltar('motivo-obrigatorio');
  }

  try {
    const updated = await conciliacaoStore.desbloquear(id, req.user.empresaId, {
      motivo,
      username: req.user.username,
    });
    if (!updated) {
      return voltar('nao-encontrada');
    }
    updateSession(id, {
      enviado: updated.enviado,
      enviadoEm: updated.enviadoEm,
      motivosEdicao: updated.motivosEdicao,
    });
    if (origem === 'revisao') {
      return res.redirect(`/revisao/${id}`);
    }
    qs.set('ok', 'desbloqueado');
    return res.redirect(`/historico?${qs.toString()}`);
  } catch (err) {
    console.error(err);
    return voltar('falha');
  }
});

router.get('/conciliar/status/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job nao encontrado' });
  }
  return res.json(publicJob(job));
});

router.post(
  '/conciliar',
  upload.fields([
    { name: 'extrato', maxCount: 1 },
    { name: 'contasPagar', maxCount: 1 },
  ]),
  async (req, res) => {
    const wantsJson = req.query.async === '1'
      || (req.headers.accept || '').includes('application/json')
      || req.headers['x-requested-with'] === 'XMLHttpRequest';

    const extratoFile = req.files?.extrato?.[0];
    const contasFile = req.files?.contasPagar?.[0];
    const bancoId = String(req.body.bancoId || '').trim();
    const competencia = conciliacaoStore.parseCompetencia(req.body.competencia);

    if (!bancoId) {
      const msg = 'Selecione o banco do extrato que esta sendo importado.';
      if (wantsJson) return res.status(400).json({ error: msg });
      return res.status(400).render('upload', await loadUploadLocals(msg));
    }

    if (!competencia) {
      const msg = 'Informe a competencia no formato MM/AAAA (ou use o seletor de mes).';
      if (wantsJson) return res.status(400).json({ error: msg });
      return res.status(400).render('upload', await loadUploadLocals(msg));
    }

    const banco = await getBancoById(bancoId);
    if (!banco || !banco.ativo) {
      const msg = 'Banco invalido ou inativo. Selecione um banco ativo.';
      if (wantsJson) return res.status(400).json({ error: msg });
      return res.status(400).render('upload', await loadUploadLocals(msg));
    }

    if (!extratoFile || !contasFile) {
      const msg = 'Envie Extrato e Contas a Pagar.';
      if (wantsJson) return res.status(400).json({ error: msg });
      return res.status(400).render('upload', await loadUploadLocals(msg));
    }

    const job = createJob();
    updateJob(job.id, { percent: 10, step: 'Arquivos recebidos…' });

    const empresaId = req.user.empresaId;
    migrateLegacyEmpresaToBanco(empresaId, banco.id);
    const storeKey = resolveStoreKey(empresaId, banco.id);

    // Processa em background; cliente faz poll
    setImmediate(async () => {
      try {
        updateJob(job.id, { percent: 25, step: 'Lendo planilhas…' });

        const extrato = await parseExtratoSmart(extratoFile.buffer, {
          onProgress: (p) => updateJob(job.id, p),
        });

        if (extrato.aiWarning) {
          updateJob(job.id, {
            percent: 68,
            step: `Aviso IA: ${extrato.aiWarning.slice(0, 120)}…`,
          });
        }

        updateJob(job.id, { percent: 70, step: 'Lendo Contas a Pagar…' });
        const contas = await parseContasPagar(contasFile.buffer, contasFile.originalname);

        updateJob(job.id, { percent: 80, step: 'Conciliando lançamentos…' });
        const { itens, resumo } = runMatching({
          lancamentos: extrato.lancamentos,
          contas,
          sessionId: storeKey,
        });

        updateJob(job.id, { percent: 95, step: 'Salvando conciliação…' });
        const session = createSession({
          arquivos: {
            extrato: extratoFile.originalname,
            contasPagar: contasFile.originalname,
          },
          empresaId,
          bancoId: banco.id,
          bancoNome: banco.nome,
          codigoCredito: banco.codigoCredito,
          competencia,
          itens,
          resumo,
          usedGemini: Boolean(extrato.usedGemini),
        });

        await conciliacaoStore.create({
          id: session.id,
          empresaId,
          bancoId: banco.id,
          bancoNome: banco.nome,
          codigoCredito: banco.codigoCredito,
          competencia,
          arquivos: session.arquivos,
          resumo,
          itens,
          usedGemini: Boolean(extrato.usedGemini),
        });

        updateJob(job.id, {
          percent: 100,
          step: 'Concluído',
          done: true,
          revisaoUrl: `/revisao/${session.id}`,
        });
      } catch (err) {
        console.error(err);
        updateJob(job.id, {
          done: true,
          error: err.message || 'Erro ao processar',
          percent: 100,
          step: 'Erro',
        });
      }
    });

    if (wantsJson) {
      return res.json({ jobId: job.id });
    }

    // Fallback sync antigo (sem JS): espera o job (ate 3 min)
    const started = Date.now();
    while (Date.now() - started < 180000) {
      const j = getJob(job.id);
      if (j?.done) {
        if (j.error) {
          return res.status(500).render('upload', await loadUploadLocals(`Erro ao processar: ${j.error}`));
        }
        return res.redirect(j.revisaoUrl);
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    return res.status(504).render('upload', await loadUploadLocals('Tempo esgotado ao processar. Tente novamente.'));
  },
);

const ERROS_REVISAO = {
  enviado: 'Conciliação enviada. Desbloqueie para editar antes de alterar.',
  'motivo-obrigatorio': 'Informe um motivo com pelo menos 3 caracteres para desbloquear.',
  falha: 'Não foi possível desbloquear. Tente novamente.',
};

/** Bloqueia mutações quando a conciliação está marcada como enviada. */
function garantirEditavel(req, res, session) {
  if (!session.enviado) return true;
  res.redirect(`/revisao/${session.id}?erro=enviado`);
  return false;
}

router.get('/revisao/:id', async (req, res) => {
  const session = await resolveSession(req.params.id, req.user.empresaId);
  if (!session) {
    return res.status(404).render('upload', await loadUploadLocals(
      'Sessao nao encontrada. Envie os arquivos novamente ou abra pelo Historico.',
    ));
  }
  const filtro = req.query.filtro || 'todos';
  const colFilters = pickColumnFilters(req.query);
  let itens = filterItens(session.itens, filtro);
  itens = applyColumnFilters(itens, colFilters);
  itens = applyColumnSort(itens, session.itens, colFilters);
  const resumo = buildResumo(session.itens);

  const ok = String(req.query.ok || '');
  let success = null;
  let successMessage = null;
  if (ok === 'precadastro') {
    success = 'precadastro';
    const n = Number(req.query.preN);
    successMessage = Number.isFinite(n)
      ? `Pré-cadastro atualizado: ${n} lançamento(s) com Débito/Crédito.`
      : 'Pré-cadastro atualizado.';
  }

  res.render('revisao', {
    session,
    itens,
    resumo,
    filtro,
    colFilters,
    error: ERROS_REVISAO[req.query.erro] || null,
    success,
    successMessage,
    capSugestoes: capSugestoesForSession(session),
    formatCompetencia: conciliacaoStore.formatCompetencia,
    formatDateTimeBr,
    currentNav: 'revisao',
  });
});

router.post('/revisao/:id/item/:rowId', express.urlencoded({ extended: true }), async (req, res) => {
  const session = await resolveSession(req.params.id, req.user.empresaId);
  if (!session) {
    return res.status(404).render('upload', await loadUploadLocals('Sessao nao encontrada.'));
  }

  if (!garantirEditavel(req, res, session)) return;

  const { rowId } = req.params;
  const action = req.body.action;
  const preKey = sessionPreKey(session);

  const itens = session.itens.map((item) => {
    if (String(item.rowId) !== String(rowId) && String(item.id) !== String(rowId)) return item;
    const next = { ...item };

    if (req.body.numeroNota !== undefined) {
      next.numeroNota = String(req.body.numeroNota).replace(/\D/g, '');
    }

    if (action === 'aprovar') {
      const podeEditarCapAprovar = (next.tipo === 'pagamento' || next.tipo === 'recebimento')
        && req.body.classificacaoCap !== undefined;
      if (podeEditarCapAprovar) {
        const capRaw = String(req.body.classificacaoCap || '').trim();
        // CAP vazia no Aprovar mantem a classificacao ja existente no item (nao apaga).
        const cap = capRaw || String(next.classificacaoCap || next.categoria || '').trim();
        if (cap) {
          const withPre = applyCapAndPre(next, cap, preKey);
          next.classificacaoCap = withPre.classificacaoCap;
          next.categoria = withPre.categoria;
          next.debito = withPre.debito;
          next.credito = withPre.credito;
          next.preCadastroId = withPre.preCadastroId;
          next.motivo = withPre.motivo;
        }
      }

      if (req.body.debito !== undefined) {
        next.debito = req.body.debito === '' ? null : Number(req.body.debito);
      }
      if (req.body.credito !== undefined) {
        next.credito = req.body.credito === '' ? null : Number(req.body.credito);
      }
      const hasDebito = next.debito !== null && next.debito !== undefined && !Number.isNaN(next.debito);
      const hasCredito = next.credito !== null && next.credito !== undefined && !Number.isNaN(next.credito);
      if (!hasDebito && !hasCredito) {
        return { ...next, error: 'Informe Debito e/ou Credito antes de aprovar' };
      }
      next.aprovado = true;
      next.error = null;
    } else if (action === 'rejeitar') {
      next.aprovado = false;
      if (next.tipo === 'recebimento') {
        next.status = 'RECEBIMENTO';
        next.classificacaoCap = 'RECEBIMENTO';
        next.categoria = 'RECEBIMENTO';
        const withPre = applyPreCadastro(next, preKey);
        next.debito = withPre.debito;
        next.credito = withPre.credito;
        next.preCadastroId = withPre.preCadastroId;
        next.motivo = withPre.motivo;
      } else {
        next.status = 'SEM_MATCH';
        next.debito = null;
        next.credito = null;
        next.classificacaoCap = '';
        next.categoria = '';
        next.preCadastroId = null;
      }
      next.numeroNota = next.numeroNota || '';
      next.error = null;
    } else if (action === 'salvar') {
      const podeEditarCap = (next.tipo === 'pagamento' || next.tipo === 'recebimento')
        && req.body.classificacaoCap !== undefined;
      if (podeEditarCap) {
        const cap = String(req.body.classificacaoCap || '').trim();
        next.classificacaoCap = cap;
        next.categoria = cap;
        const withPre = applyPreCadastro(next, preKey);
        next.classificacaoCap = withPre.classificacaoCap;
        next.categoria = withPre.categoria;
        next.debito = withPre.debito;
        next.credito = withPre.credito;
        next.preCadastroId = withPre.preCadastroId;
        next.motivo = withPre.motivo;
      }

      const debitoRaw = req.body.debito;
      const creditoRaw = req.body.credito;
      const debitoTyped = debitoRaw !== undefined && String(debitoRaw).trim() !== '';
      const creditoTyped = creditoRaw !== undefined && String(creditoRaw).trim() !== '';
      const capEditada = podeEditarCap;

      if (debitoTyped) {
        next.debito = Number(debitoRaw);
      } else if (debitoRaw !== undefined && !capEditada) {
        next.debito = null;
      }

      if (creditoTyped) {
        next.credito = Number(creditoRaw);
      } else if (creditoRaw !== undefined && !capEditada) {
        next.credito = null;
      }

      next.error = null;
    }

    return next;
  });

  await persistSessionUpdate(session.id, { itens, resumo: buildResumo(itens) });
  return redirectRevisao(res, session.id, req.body);
});

router.post('/revisao/:id/excluir-selecionados', express.urlencoded({ extended: true }), async (req, res) => {
  const session = await resolveSession(req.params.id, req.user.empresaId);
  if (!session) {
    return res.status(404).render('upload', await loadUploadLocals('Sessao nao encontrada.'));
  }
  if (!garantirEditavel(req, res, session)) return;
  const { itens, removed } = excludeItems(session.itens || [], req.body.rowIds);
  if (!removed) {
    return redirectRevisao(res, session.id, req.body);
  }
  await persistSessionUpdate(session.id, { itens, resumo: buildResumo(itens) });
  return redirectRevisao(res, session.id, req.body);
});

router.post('/revisao/:id/reaplicar-precadastro', express.urlencoded({ extended: true }), async (req, res) => {
  const session = await resolveSession(req.params.id, req.user.empresaId);
  if (!session) {
    return res.status(404).render('upload', await loadUploadLocals('Sessao nao encontrada.'));
  }
  if (!garantirEditavel(req, res, session)) return;
  const preKey = sessionPreKey(session);
  const { itens } = reapplyPreCadastroItems(session.itens || [], preKey, req.body.rowIds);
  await persistSessionUpdate(session.id, { itens, resumo: buildResumo(itens) });
  const comCodigos = itens.filter((i) => i.debito != null || i.credito != null).length;
  return redirectRevisao(res, session.id, req.body, { ok: 'precadastro', preN: comCodigos });
});

router.post('/revisao/:id/aplicar-cap-lote', express.urlencoded({ extended: true }), async (req, res) => {
  const session = await resolveSession(req.params.id, req.user.empresaId);
  if (!session) {
    return res.status(404).render('upload', await loadUploadLocals('Sessao nao encontrada.'));
  }
  if (!garantirEditavel(req, res, session)) return;
  const preKey = sessionPreKey(session);
  const result = applyCapLote(
    session.itens || [],
    req.body.rowIds,
    req.body.classificacaoCap,
    preKey,
  );
  if (result.error) {
    const filtro = req.body.filtro || 'todos';
    const colFilters = pickColumnFilters(req.body);
    let itensView = filterItens(session.itens, filtro);
    itensView = applyColumnFilters(itensView, colFilters);
    itensView = applyColumnSort(itensView, session.itens, colFilters);
    return res.status(400).render('revisao', {
      session,
      itens: itensView,
      resumo: buildResumo(session.itens),
      filtro,
      colFilters,
      error: result.error,
      capSugestoes: capSugestoesForSession(session),
      formatCompetencia: conciliacaoStore.formatCompetencia,
      formatDateTimeBr,
      currentNav: 'revisao',
    });
  }
  await persistSessionUpdate(session.id, {
    itens: result.itens,
    resumo: buildResumo(result.itens),
  });
  return redirectRevisao(res, session.id, req.body);
});

router.post('/revisao/:id/aprovar-altos', async (req, res) => {
  const session = await resolveSession(req.params.id, req.user.empresaId);
  if (!session) {
    return res.status(404).render('upload', await loadUploadLocals('Sessao nao encontrada.'));
  }
  if (!garantirEditavel(req, res, session)) return;
  const itens = session.itens.map((item) => {
    if ((item.status === 'MATCHED' || item.status === 'REGRA')
      && item.preCadastroId
      && (item.debito != null || item.credito != null)) {
      return { ...item, aprovado: true };
    }
    return item;
  });
  await persistSessionUpdate(session.id, { itens, resumo: buildResumo(itens) });
  return redirectRevisao(res, session.id, req.body);
});

router.get('/resultado/:id', async (req, res) => {
  const session = await resolveSession(req.params.id, req.user.empresaId);
  if (!session) {
    return res.status(404).render('upload', await loadUploadLocals('Sessao nao encontrada.'));
  }
  const itensExport = session.itens || [];
  const resumo = buildResumo(session.itens);
  res.render('resultado', {
    session,
    resumo,
    itensExport,
    formatCompetencia: conciliacaoStore.formatCompetencia,
    currentNav: 'resultado',
  });
});

router.get('/export/:id.txt', async (req, res) => {
  const session = await resolveSession(req.params.id, req.user.empresaId);
  if (!session) {
    return res.status(404).send('Sessao nao encontrada');
  }
  const itensExport = session.itens || [];
  if (!itensExport.length) {
    return res.status(400).send('Nenhum lancamento para exportar');
  }
  try {
    const buffer = exportDominioTxt(itensExport);
    setNoCacheHeaders(res);
    res.setHeader('Content-Type', 'text/plain; charset=windows-1252');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="PLANILHA_PADRAO_DOMINIO.txt"',
    );
    return res.send(buffer);
  } catch (err) {
    console.error(err);
    return res.status(500).send(`Erro no export: ${err.message}`);
  }
});

router.get('/export/:id', async (req, res) => {
  const session = await resolveSession(req.params.id, req.user.empresaId);
  if (!session) {
    return res.status(404).send('Sessao nao encontrada');
  }
  const itensExport = session.itens || [];
  if (!itensExport.length) {
    return res.status(400).send('Nenhum lancamento para exportar');
  }
  try {
    const buffer = await exportDominio(itensExport);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="PLANILHA_PADRAO_DOMINIO.xlsx"',
    );
    return res.send(buffer);
  } catch (err) {
    console.error(err);
    return res.status(500).send(`Erro no export: ${err.message}`);
  }
});

router.get('/export/:id/detalhado.xlsx', async (req, res) => {
  const session = await resolveSession(req.params.id, req.user.empresaId);
  if (!session) {
    return res.status(404).send('Sessao nao encontrada');
  }
  const itens = session.itens || [];
  if (!itens.length) {
    return res.status(400).send('Nenhum lancamento para exportar');
  }
  try {
    const buffer = await exportRelatorioExcel(session, itens);
    setNoCacheHeaders(res);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${relatorioFileName(session, 'xlsx')}"`,
    );
    return res.send(buffer);
  } catch (err) {
    console.error(err);
    return res.status(500).send(`Erro no export: ${err.message}`);
  }
});

router.get('/export/:id/detalhado.pdf', async (req, res) => {
  const session = await resolveSession(req.params.id, req.user.empresaId);
  if (!session) {
    return res.status(404).send('Sessao nao encontrada');
  }
  const itens = session.itens || [];
  if (!itens.length) {
    return res.status(400).send('Nenhum lancamento para exportar');
  }
  try {
    const buffer = await exportRelatorioPdf(session, itens);
    setNoCacheHeaders(res);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${relatorioFileName(session, 'pdf')}"`,
    );
    return res.send(buffer);
  } catch (err) {
    console.error(err);
    return res.status(500).send(`Erro no export: ${err.message}`);
  }
});

module.exports = router;

'use strict';

const express = require('express');
const {
  list,
  create,
  update,
  remove,
  storeKeyForEmpresaBanco,
  migrateLegacyEmpresaToBanco,
} = require('../services/preCadastroStore');
const {
  listBancos,
  getBancoById,
  getFirstActiveBanco,
} = require('../services/bancoService');
const { requireEmpresa } = require('../middleware/session');

const router = express.Router();

function storeKey(empresaId, bancoId) {
  return storeKeyForEmpresaBanco(empresaId, bancoId);
}

function redirectPreCadastro(bancoId, extra = {}) {
  const params = new URLSearchParams();
  params.set('banco', bancoId);
  Object.entries(extra).forEach(([k, v]) => {
    if (v != null && v !== '') params.set(k, String(v));
  });
  return `/pre-cadastro?${params.toString()}`;
}

async function resolveBanco(req) {
  const bancos = await listBancos({ onlyAtivos: true });
  if (!bancos.length) {
    return { bancos: [], banco: null, error: 'Nenhum banco ativo cadastrado. Contate o administrador.' };
  }

  const requestedId = req.query.banco || req.body.bancoId || req.body.banco;
  let banco = requestedId ? bancos.find((b) => b.id === requestedId) : null;
  if (!banco && requestedId) {
    const byId = await getBancoById(requestedId);
    if (byId && byId.ativo) banco = byId;
  }
  if (!banco) {
    banco = await getFirstActiveBanco() || bancos[0];
  }
  return { bancos, banco, error: null };
}

function renderPreCadastro(res, {
  bancos,
  banco,
  itens,
  error,
  success,
  editId,
  status = 200,
}) {
  return res.status(status).render('preCadastro', {
    bancos,
    banco,
    itens,
    error,
    success,
    editId,
    defaultCredito: banco ? banco.codigoCredito : '',
    currentNav: 'precadastro',
  });
}

router.get('/pre-cadastro', requireEmpresa, async (req, res) => {
  try {
    const { bancos, banco, error } = await resolveBanco(req);
    if (!banco) {
      return renderPreCadastro(res, {
        bancos,
        banco: null,
        itens: [],
        error,
        success: null,
        editId: null,
        status: 400,
      });
    }

    if (!req.query.banco || req.query.banco !== banco.id) {
      const qs = new URLSearchParams();
      qs.set('banco', banco.id);
      if (req.query.ok) qs.set('ok', req.query.ok);
      if (req.query.edit) qs.set('edit', req.query.edit);
      return res.redirect(`/pre-cadastro?${qs.toString()}`);
    }

    migrateLegacyEmpresaToBanco(req.user.empresaId, banco.id);

    return renderPreCadastro(res, {
      bancos,
      banco,
      itens: list(storeKey(req.user.empresaId, banco.id)),
      error: null,
      success: req.query.ok || null,
      editId: req.query.edit || null,
    });
  } catch (err) {
    return renderPreCadastro(res, {
      bancos: [],
      banco: null,
      itens: [],
      error: err.message,
      success: null,
      editId: null,
      status: 500,
    });
  }
});

router.post('/pre-cadastro', requireEmpresa, async (req, res) => {
  try {
    const { bancos, banco, error } = await resolveBanco(req);
    if (!banco) {
      return renderPreCadastro(res, {
        bancos,
        banco: null,
        itens: [],
        error,
        success: null,
        editId: null,
        status: 400,
      });
    }

    migrateLegacyEmpresaToBanco(req.user.empresaId, banco.id);

    const creditoRaw = req.body.credito;
    const credito = (creditoRaw === undefined || creditoRaw === null || String(creditoRaw).trim() === '')
      ? banco.codigoCredito
      : creditoRaw;

    create(storeKey(req.user.empresaId, banco.id), {
      descricao: req.body.descricao,
      debito: req.body.debito,
      credito,
    });
    return res.redirect(redirectPreCadastro(banco.id, { ok: 'criado' }));
  } catch (err) {
    const { bancos, banco } = await resolveBanco(req).catch(() => ({ bancos: [], banco: null }));
    return renderPreCadastro(res, {
      bancos,
      banco,
      itens: banco ? list(storeKey(req.user.empresaId, banco.id)) : [],
      error: err.message,
      success: null,
      editId: null,
      status: 400,
    });
  }
});

router.post('/pre-cadastro/:id', requireEmpresa, async (req, res) => {
  try {
    const { bancos, banco, error } = await resolveBanco(req);
    if (!banco) {
      return renderPreCadastro(res, {
        bancos,
        banco: null,
        itens: [],
        error,
        success: null,
        editId: null,
        status: 400,
      });
    }

    const key = storeKey(req.user.empresaId, banco.id);
    if (req.body._method === 'DELETE') {
      remove(key, req.params.id);
      return res.redirect(redirectPreCadastro(banco.id, { ok: 'excluido' }));
    }
    update(key, req.params.id, {
      descricao: req.body.descricao,
      debito: req.body.debito,
      credito: req.body.credito,
    });
    return res.redirect(redirectPreCadastro(banco.id, { ok: 'atualizado' }));
  } catch (err) {
    const { bancos, banco } = await resolveBanco(req).catch(() => ({ bancos: [], banco: null }));
    return renderPreCadastro(res, {
      bancos,
      banco,
      itens: banco ? list(storeKey(req.user.empresaId, banco.id)) : [],
      error: err.message,
      success: null,
      editId: req.params.id,
      status: 400,
    });
  }
});

module.exports = router;

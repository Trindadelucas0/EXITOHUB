'use strict';

const express = require('express');
const { requireAdmin } = require('../middleware/session');
const {
  listEmpresas,
  createEmpresa,
  updateEmpresa,
  setActingEmpresa,
  clearActingEmpresa,
} = require('../services/authService');
const {
  listBancos,
  createBanco,
  updateBanco,
} = require('../services/bancoService');

const router = express.Router();

router.get('/admin/empresas', requireAdmin, async (req, res) => {
  try {
    const empresas = await listEmpresas();
    res.render('adminEmpresas', {
      empresas,
      error: null,
      success: req.query.ok || null,
      currentNav: 'empresas',
    });
  } catch (err) {
    res.status(500).render('adminEmpresas', {
      empresas: [],
      error: err.message,
      success: null,
      currentNav: 'empresas',
    });
  }
});

router.post('/admin/empresas', requireAdmin, async (req, res) => {
  try {
    await createEmpresa({
      nome: req.body.nome,
    });
    return res.redirect('/admin/empresas?ok=criada');
  } catch (err) {
    const empresas = await listEmpresas().catch(() => []);
    return res.status(400).render('adminEmpresas', {
      empresas,
      error: err.message,
      success: null,
      currentNav: 'empresas',
    });
  }
});

router.post('/admin/empresas/:id', requireAdmin, async (req, res) => {
  try {
    const action = req.body.action;
    if (action === 'abrir') {
      await setActingEmpresa(req.sessionId, req.params.id);
      return res.redirect('/');
    }
    if (action === 'toggle') {
      const ativo = req.body.ativo === 'true';
      await updateEmpresa(req.params.id, { ativo: !ativo });
      return res.redirect('/admin/empresas?ok=status');
    }
    await updateEmpresa(req.params.id, {
      nome: req.body.nome,
    });
    return res.redirect('/admin/empresas?ok=atualizada');
  } catch (err) {
    const empresas = await listEmpresas().catch(() => []);
    return res.status(400).render('adminEmpresas', {
      empresas,
      error: err.message,
      success: null,
      currentNav: 'empresas',
    });
  }
});

router.post('/admin/sair-empresa', requireAdmin, async (req, res) => {
  try {
    await clearActingEmpresa(req.sessionId);
    return res.redirect('/admin/empresas');
  } catch (err) {
    return res.redirect(`/admin/empresas?erro=${encodeURIComponent(err.message)}`);
  }
});

router.get('/admin/bancos', requireAdmin, async (req, res) => {
  try {
    const bancos = await listBancos();
    res.render('adminBancos', {
      bancos,
      error: null,
      success: req.query.ok || null,
      currentNav: 'bancos',
    });
  } catch (err) {
    res.status(500).render('adminBancos', {
      bancos: [],
      error: err.message,
      success: null,
      currentNav: 'bancos',
    });
  }
});

router.post('/admin/bancos', requireAdmin, async (req, res) => {
  try {
    await createBanco({
      nome: req.body.nome,
      codigoCredito: req.body.codigoCredito,
    });
    return res.redirect('/admin/bancos?ok=criado');
  } catch (err) {
    const bancos = await listBancos().catch(() => []);
    return res.status(400).render('adminBancos', {
      bancos,
      error: err.message,
      success: null,
      currentNav: 'bancos',
    });
  }
});

router.post('/admin/bancos/:id', requireAdmin, async (req, res) => {
  try {
    const action = req.body.action;
    if (action === 'toggle') {
      const ativo = req.body.ativo === 'true';
      await updateBanco(req.params.id, { ativo: !ativo });
      return res.redirect('/admin/bancos?ok=status');
    }
    await updateBanco(req.params.id, {
      nome: req.body.nome,
      codigoCredito: req.body.codigoCredito,
    });
    return res.redirect('/admin/bancos?ok=atualizado');
  } catch (err) {
    const bancos = await listBancos().catch(() => []);
    return res.status(400).render('adminBancos', {
      bancos,
      error: err.message,
      success: null,
      currentNav: 'bancos',
    });
  }
});

module.exports = router;

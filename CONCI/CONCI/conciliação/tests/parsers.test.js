'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { parseExtrato, parseExtratoMatrix, parseExtratoWithMap } = require('../src/services/parsers/extrato');
const { validateMap, MSG_SEM_DADOS } = require('../src/services/parsers/extratoValidate');
const { parseContasPagar, parseContasPagarMatrix } = require('../src/services/parsers/contasPagar');
const { enqueueAi } = require('../src/services/aiQueue');
const { validateConta } = require('../src/services/parsers/contasPagarValidate');

const fixturesDir = path.join(__dirname, '..', 'fixtures');
const calibracaoDir = path.join(fixturesDir, 'calibracao');

function fixture(matcher) {
  const dirs = [fixturesDir, calibracaoDir].filter((d) => fs.existsSync(d));
  for (const dir of dirs) {
    const name = fs.readdirSync(dir).find(matcher);
    if (name) return path.join(dir, name);
  }
  assert.ok(false, `fixture nao encontrada: ${matcher}`);
}

describe('parsers', () => {
  it('parse extrato Itau com !ref curto', () => {
    const file = fixture((f) => /itau/i.test(f) && /\.xlsx$/i.test(f));
    const result = parseExtrato(file);
    assert.ok(result.pagamentos.length >= 300);
    assert.ok(result.recebimentos.length >= 100);
    const first = result.pagamentos.find((p) => p.historico.includes('MENEGOTTI'));
    assert.ok(first);
    assert.equal(first.valor, -1648.58);
  });

  it('parse extrato layout Debito/Credito', () => {
    const rows = [
      ['Ignorar', 'cabecalho'],
      ['Data', 'Historico', 'Debito', 'Credito'],
      ['01/04/2026', 'PIX ENVIADO', '50,00', ''],
      ['01/04/2026', 'PIX RECEBIDO', '', '100,00'],
      ['02/04/2026', 'SALDO DO DIA', '', ''],
    ];
    const result = parseExtratoMatrix(rows);
    assert.equal(result.lancamentos.length, 2);
    assert.equal(result.pagamentos[0].valor, -50);
    assert.equal(result.recebimentos[0].valor, 100);
    assert.equal(result.recebimentos[0].historico, 'PIX RECEBIDO');
  });

  it('parse extrato layout Valor + Tipo D/C', () => {
    const rows = [
      ['Data', 'Descricao', 'Valor', 'Tipo'],
      ['2026-04-01', 'TARIFA', '1.89', 'D'],
      ['2026-04-01', 'DEPOSITO', '200', 'C'],
    ];
    const result = parseExtratoMatrix(rows);
    assert.equal(result.pagamentos[0].valor, -1.89);
    assert.equal(result.recebimentos[0].valor, 200);
  });

  it('extrato BB: coluna Inf. C/D prevalece sobre historico com Debito', () => {
    const rows = [
      ['Data', 'observacao', 'Historico', 'Valor R$', 'Inf.'],
      ['01/04/2026', '01/04/2026', 'Cielo Vendas Débito', '1.543,84', 'C'],
      ['01/04/2026', '01/04/2026', 'Pagamento boleto', '100,00', 'D'],
    ];
    const result = parseExtratoMatrix(rows);
    const cielo = result.lancamentos.find((l) => /Cielo/i.test(l.historico));
    const pag = result.lancamentos.find((l) => /boleto/i.test(l.historico));
    assert.ok(cielo);
    assert.equal(cielo.valor, 1543.84);
    assert.ok(pag);
    assert.equal(pag.valor, -100);
  });

  it('extrato BB: Historico + Detalhamento Hist. concatena com " - "', () => {
    const rows = [
      ['Data', 'observacao', 'Historico', 'Valor R$', 'Inf.', 'Detalhamento Hist.'],
      ['01/04/2026', ' ', 'Cielo Vendas Débito      ', '1.543,84 ', 'C', '                                      '],
      ['01/04/2026', ' ', 'Pix - Recebido            ', '50,00 ', 'C', '01/04 09:30 00001587514001 GUILHERME J'],
      ['01/04/2026', ' ', 'Pix-Recebido QR Code      ', '100,00 ', 'C', '01/04 09:22 00000189238100 JERRI NAIM '],
    ];
    const result = parseExtratoMatrix(rows);
    const cielo = result.lancamentos.find((l) => /Cielo/i.test(l.historico));
    const pix = result.lancamentos.find((l) => /GUILHERME/i.test(l.historico));
    const qr = result.lancamentos.find((l) => /JERRI/i.test(l.historico));

    assert.ok(cielo);
    assert.equal(cielo.historico, 'Cielo Vendas Débito');
    assert.equal(cielo.valor, 1543.84);

    assert.ok(pix);
    assert.equal(pix.historico, 'Pix - Recebido - 01/04 09:30 00001587514001 GUILHERME J');
    assert.equal(pix.valor, 50);

    assert.ok(qr);
    assert.equal(qr.historico, 'Pix-Recebido QR Code - 01/04 09:22 00000189238100 JERRI NAIM');
  });

  it('valor absoluto + historico: inferir saida/entrada', () => {
    const rows = [
      ['Data', 'Historico', 'Valor (R$)'],
      ['01/04/2026', 'BOLETO PAGO MENEGOTTI', '1648,58'],
      ['01/04/2026', 'PIX ENVIADO JOAO', '50,00'],
      ['01/04/2026', 'PIX RECEBIDO MARIA', '100,00'],
      ['01/04/2026', 'TAR/CUSTAS COBRANCA', '1,89'],
    ];
    const result = parseExtratoMatrix(rows);
    assert.equal(result.pagamentos.length, 3);
    assert.equal(result.recebimentos.length, 1);
    assert.equal(result.pagamentos.find((p) => p.historico.includes('MENEGOTTI')).valor, -1648.58);
    assert.equal(result.recebimentos[0].valor, 100);
  });

  it('money com minus unicode e parenteses', () => {
    const { money, parseDate } = require('../src/services/utils');
    assert.equal(money('(50,00)'), -50);
    assert.equal(money('50,00-'), -50);
    assert.equal(money('R$ 1.234,56'), 1234.56);
    assert.equal(money('\u221210,5'), -10.5);
    assert.equal(parseDate('01-06-2026'), '2026-06-01');
    assert.equal(parseDate('30/04/2026 17:35'), '2026-04-30');
    assert.equal(parseDate('2026-04-30'), '2026-04-30');
  });

  it('parse extrato Mercado Pago (headers EN)', () => {
    const rows = [
      ['INITIAL_BALANCE', 'CREDITS', 'DEBITS', 'FINAL_BALANCE'],
      ['0,00', '100,00', '-50,00', '50,00'],
      [],
      ['RELEASE_DATE', 'TRANSACTION_TYPE', 'REFERENCE_ID', 'TRANSACTION_NET_AMOUNT', 'PARTIAL_BALANCE'],
      ['01-06-2026', 'Liberação de dinheiro', '159', '217,88', '217,88'],
      ['01-06-2026', 'Débito por dívida Devoluções', '154', '-61,14', '156,74'],
    ];
    const result = parseExtratoMatrix(rows);
    assert.equal(result.recebimentos.length, 1);
    assert.equal(result.pagamentos.length, 1);
    assert.equal(result.recebimentos[0].valor, 217.88);
    assert.equal(result.recebimentos[0].data, '2026-06-01');
    assert.equal(result.pagamentos[0].valor, -61.14);
    assert.ok(result.pagamentos[0].historico.includes('Débito'));
  });

  it('parse extrato Mercado Pago mantem sinal de TRANSACTION_NET_AMOUNT (nao inverte por historico)', () => {
    const rows = [
      ['RELEASE_DATE', 'TRANSACTION_TYPE', 'REFERENCE_ID', 'TRANSACTION_NET_AMOUNT', 'PARTIAL_BALANCE'],
      // "Pagamento" bateria na heuristica bancaria como saida, mas no MP e entrada (+)
      ['01-06-2026', 'Pagamento aprovado', '160', '99,90', '316,64'],
      // "Reembolso" bateria na heuristica bancaria como entrada, mas no MP e saida (-)
      ['02-06-2026', 'Reembolso', '161', '-45,00', '271,64'],
    ];
    const result = parseExtratoMatrix(rows);
    assert.equal(result.recebimentos.length, 1);
    assert.equal(result.pagamentos.length, 1);
    assert.equal(result.recebimentos[0].valor, 99.9);
    assert.ok(result.recebimentos[0].historico.includes('Pagamento'));
    assert.equal(result.pagamentos[0].valor, -45);
    assert.ok(result.pagamentos[0].historico.includes('Reembolso'));
  });

  it('parse extrato Stone/Pix (Movimentacao + Destino/Origem)', () => {
    const rows = [
      [
        'Movimentação', 'Tipo', 'Valor', 'Saldo antes', 'Saldo depois', 'Tarifa', 'Data',
        'Nosso Número', 'Situação', 'Destino', 'Destino Documento', 'Destino Instituição',
        'Destino Agência', 'Destino Conta', 'Origem', 'Origem Documento',
        'Origem Instituição', 'Origem Agência', 'Origem Conta',
      ],
      [
        'Débito', 'Pix', '-13.750,00', 'R$ 1', 'R$ 0', 'Grátis', '30/04/2026 17:35',
        '', 'Enviado', 'FORNECEDOR XYZ LTDA', '12.345.678/0001-99', 'ITAÚ',
        '', '', 'EMPRESA LOCAL', '11.111.111/0001-11', 'Stone', '', '',
      ],
      [
        'Crédito', 'Pix', '1.750,00', 'R$ 0', 'R$ 1', 'Grátis', '30/04/2026 16:00',
        '', 'Recebido', 'EMPRESA LOCAL', '11.111.111/0001-11', 'Stone',
        '', '', 'CLIENTE ABC LTDA', '22.222.222/0001-22', 'BB', '', '',
      ],
    ];
    const result = parseExtratoMatrix(rows);
    assert.equal(result.pagamentos.length, 1);
    assert.equal(result.recebimentos.length, 1);
    assert.equal(result.pagamentos[0].valor, -13750);
    assert.equal(result.pagamentos[0].cnpj, '12345678000199');
    assert.ok(result.pagamentos[0].historico.includes('Pix'));
    assert.ok(result.pagamentos[0].razaoSocial.includes('FORNECEDOR'));
    assert.equal(result.recebimentos[0].valor, 1750);
    assert.equal(result.recebimentos[0].cnpj, '22222222000122');
    assert.ok(result.recebimentos[0].razaoSocial.includes('CLIENTE'));
  });

  it('extrato sem cabecalho util gera erro claro', () => {
    assert.throws(
      () => parseExtratoMatrix([['foo', 'bar'], ['1', '2']]),
      /sem dados utilizaveis|faltam colunas|Cabecalho/i,
    );
  });

  it('validateMap rejeita mapa da IA invalido', () => {
    const rows = [
      ['Data', 'Historico', 'Valor'],
      ['01/04/2026', 'PIX', '-10'],
    ];
    const bad = validateMap(rows, {
      headerRow: 0,
      dataCol: 0,
      historicoCol: 1,
      valorCol: 99,
    });
    assert.equal(bad.ok, false);
  });

  it('parseExtratoWithMap aplica mapa valido', () => {
    const rows = [
      ['X', 'Y', 'Z'],
      ['01/04/2026', 'PAGTO', '-25,50'],
    ];
    // mapa aponta colunas sem cabecalho nomeado — amostra ainda valida data/valor
    const result = parseExtratoWithMap(rows, {
      headerIdx: 0,
      dataIdx: 0,
      histIdx: 1,
      valorIdx: 2,
      debitoIdx: -1,
      creditoIdx: -1,
      tipoIdx: -1,
      razaoIdx: -1,
      cnpjIdx: -1,
    });
    assert.equal(result.lancamentos.length, 1);
    assert.equal(result.pagamentos[0].valor, -25.5);
  });

  it('planilha sem lancamentos validos avisa', () => {
    assert.throws(
      () => parseExtratoMatrix([
        ['Data', 'Historico', 'Valor'],
        ['xx', 'SALDO', ''],
      ]),
      /sem dados|Validacao falhou|Nenhum lancamento/i,
    );
  });

  it('fila IA serializa chamadas', async () => {
    process.env.GEMINI_MIN_INTERVAL_MS = '0';
    process.env.GEMINI_MAX_CALLS_PER_HOUR = '100';
    const order = [];
    const p1 = enqueueAi(async () => {
      order.push('a-start');
      await new Promise((r) => setTimeout(r, 50));
      order.push('a-end');
      return 1;
    });
    const p2 = enqueueAi(async () => {
      order.push('b-start');
      order.push('b-end');
      return 2;
    });
    await Promise.all([p1, p2]);
    assert.deepEqual(order, ['a-start', 'a-end', 'b-start', 'b-end']);
  });

  it('parse contas a pagar ODS', async () => {
    const file = fixture((f) => /contas-pagar-baifer/i.test(f) && f.toLowerCase().endsWith('.ods'));
    const contas = await parseContasPagar(file, path.basename(file));
    assert.ok(contas.length >= 300);
    assert.ok(contas.some((c) => c.categoria === 'FORNECEDORES'));
    assert.ok(contas.some((c) => c.nrNota));
    assert.ok(contas.every((c) => c.valor != null && Math.abs(c.valor) > 0));
  });

  it('contas a pagar layout grupo Santri (Loja das Maquinas)', () => {
    const rows = [
      ['Empresa: LOJA'],
      [
        'Código',
        'Cliente/Fornecedor',
        'Nome do Cliente/Fornecedor',
        'CPF/CNPJ',
        'Situação',
        'Bloq. desp',
        'Documento',
        'Nr. nota',
        'Data venc.',
        'Data pagto',
        'Vlr. docum',
        'Vlr. adiant',
        'Sld. devedor',
        'Tipo',
        'Vlr. líquido',
      ],
      ['', '1.001.006', 'BOLETOS'],
      [
        '31.278',
        '35.077',
        'MINISTERIO DA FAZENDA',
        '00.394.460/0492-30',
        'Bx',
        '',
        'RECE FEDERAL',
        '',
        '15/06/2026',
        '15/06/2026',
        '355.25',
        '',
        '',
        'Dup',
        '355.25',
      ],
      ['', '', 'Total do plano', '', '355.25'],
      ['', '2.001.001', 'FORNECEDORES'],
      [
        '27.816',
        '1',
        'FORNECEDOR XYZ LTDA',
        '12.345.678/0001-99',
        'Bx',
        '',
        'NF 1',
        '100',
        '01/06/2026',
        '01/06/2026',
        '427.06',
        '',
        '',
        'Bol',
        '427.06',
      ],
    ];
    const contas = parseContasPagarMatrix(rows);
    assert.equal(contas.length, 2);
    assert.equal(contas[0].categoria, 'BOLETOS');
    assert.equal(contas[0].nome, 'MINISTERIO DA FAZENDA');
    assert.equal(contas[0].valor, 355.25);
    assert.ok(!/^\d/.test(contas[0].categoria));
    assert.equal(contas[1].categoria, 'FORNECEDORES');
    assert.equal(contas[1].valor, 427.06);
  });

  it('validateConta rejeita categoria numerica e sem valor', () => {
    const badCat = validateConta({
      categoria: '31.278',
      nome: 'TESTE',
      cnpj: '12345678000199',
      valor: 10,
      vencimento: '2026-01-01',
      pagamento: null,
    });
    assert.equal(badCat.ok, false);

    const badVal = validateConta({
      categoria: 'FORNECEDORES',
      nome: 'TESTE',
      cnpj: '12345678000199',
      valor: null,
      vencimento: '2026-01-01',
      pagamento: null,
    });
    assert.equal(badVal.ok, false);
  });
});

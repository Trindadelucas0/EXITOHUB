'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

const { exportRelatorioExcel, exportRelatorioPdf } = require('../src/services/exportRelatorio');

function fakeSession() {
  return {
    id: 'sessao-teste',
    bancoNome: 'Banco Teste S.A.',
    competencia: '2026-06',
  };
}

function fakeItens() {
  return [
    {
      data: '2026-06-25',
      debito: 8,
      credito: 1000,
      valor: 5000,
      historico: 'Pix — Crédito — RESTAURA NO 12 LTDA',
      motivo: 'RECEBIMENTO',
      numeroNota: '',
      classificacaoCap: 'RECEBIMENTO',
    },
    {
      data: '2026-06-18',
      debito: null,
      credito: null,
      valor: -4470,
      historico: 'Pix — Débito — BAIFER DISTRIBUIDORA DE FERRAMENTAS LTDA',
      motivo: 'sem-match',
      numeroNota: '490932',
      classificacaoCap: '',
    },
  ];
}

describe('exportRelatorioExcel', () => {
  it('mostra banco e competência corretos no cabeçalho e todas as linhas', async () => {
    const session = fakeSession();
    const itens = fakeItens();

    const buffer = await exportRelatorioExcel(session, itens);
    assert.ok(buffer.length > 0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];

    // Coluna A é reservada para a logo; texto começa na coluna B.
    assert.equal(sheet.getCell(2, 2).value, 'Banco: Banco Teste S.A.');
    assert.equal(sheet.getCell(3, 2).value, 'Competência: 06/2026');
    assert.equal(workbook.model.media.length, 1, 'logo deve estar embutida no Excel');

    const headerValues = sheet.getRow(5).values.slice(1);
    assert.deepEqual(headerValues, [
      'Data',
      'Débito',
      'Crédito',
      'Valor',
      'Histórico',
      'Nº Nota',
      'Classificação Êxito',
      'Situação',
      'Verificação do cliente',
      'Observação',
    ]);
    assert.equal(sheet.getCell(5, 1).fill.fgColor.argb, 'FF39B54A');
    assert.match(String(sheet.getCell(4, 2).value), /Sem classificação: 1 · Sem débito e sem crédito: 1/);

    assert.equal(sheet.views[0].state, 'frozen');
    assert.equal(sheet.views[0].ySplit, 5);
    assert.ok(sheet.autoFilter, 'linha 5 deve ter filtro automático');

    // 2 linhas de dados após título/banco/competência/gerado-em/cabecalho (linhas 1-5)
    assert.equal(sheet.rowCount, 5 + itens.length);

    const row6 = sheet.getRow(6).values.slice(1);
    assert.equal(row6[0], '25/06/2026');
    assert.equal(row6[1], 8);
    assert.equal(row6[2], 1000);
    assert.equal(row6[4], 'Pix — Crédito — RESTAURA NO 12 LTDA');
    assert.equal(row6[6], 'RECEBIMENTO');
    assert.equal(row6[7], 'Classificado');
    assert.equal(row6[8] ?? '', '');
    assert.equal(row6[9] ?? '', '');
    assert.notEqual(sheet.getCell(6, 1).fill?.fgColor?.argb, 'FFF8E8C8');

    const row7 = sheet.getRow(7).values.slice(1);
    assert.equal(row7[4], 'Pix — Débito — BAIFER DISTRIBUIDORA DE FERRAMENTAS LTDA');
    assert.equal(row7[5], '490932');
    assert.equal(row7[7], 'Sem classificação');
    assert.equal(row7[8] ?? '', '');
    assert.equal(row7[9] ?? '', '');
    assert.equal(sheet.getCell(7, 1).fill.fgColor.argb, 'FFF8E8C8');
    assert.equal(sheet.getCell(7, 4).font.color.argb, 'FFB91C1C');

    const verificacaoCell = sheet.getCell(6, 9);
    assert.equal(verificacaoCell.dataValidation.type, 'list');
    assert.deepEqual(verificacaoCell.dataValidation.formulae, ['"OK,PENDENTE"']);
  });

  it('marca Aprovado quando o item está aprovado', async () => {
    const itens = [
      {
        data: '2026-06-20',
        debito: 2101,
        credito: 9,
        valor: -150,
        historico: 'PIX IMOBILIARIA SILVA',
        numeroNota: '',
        classificacaoCap: 'ALUGUEL',
        aprovado: true,
      },
    ];
    const buffer = await exportRelatorioExcel(fakeSession(), itens);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    assert.equal(sheet.getCell(6, 8).value, 'Aprovado');
  });

  it('preenche a coluna Classificação Êxito com valor editado manualmente', async () => {
    const session = fakeSession();
    const itens = [
      {
        data: '2026-06-10',
        debito: null,
        credito: null,
        valor: -320,
        historico: 'Pix — Débito — FORNECEDOR MANUAL LTDA',
        motivo: 'sem-match',
        numeroNota: '',
        classificacaoCap: 'FRETES SOBRE COMPRAS',
      },
      {
        data: '2026-06-11',
        debito: null,
        credito: null,
        valor: -80,
        historico: 'Pix — Débito — LEGADO SEM CAP',
        motivo: 'sem-match',
        numeroNota: '',
        classificacaoCap: '',
        categoria: 'ENERGIA',
      },
    ];

    const buffer = await exportRelatorioExcel(session, itens);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];

    assert.equal(sheet.getCell(6, 7).value, 'FRETES SOBRE COMPRAS');
    assert.equal(sheet.getCell(7, 7).value, 'ENERGIA');
    assert.equal(sheet.getCell(6, 8).value, 'Sem débito/crédito');
    assert.equal(sheet.getCell(7, 8).value, 'Sem débito/crédito');
    assert.equal(sheet.getCell(6, 1).fill.fgColor.argb, 'FFF8E8C8');
  });

  it('usa rótulos padrão quando banco/competência não estão definidos', async () => {
    const buffer = await exportRelatorioExcel({ id: 'x' }, []);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    assert.equal(sheet.getCell(2, 2).value, 'Banco: Não informado');
    assert.equal(sheet.getCell(3, 2).value, 'Competência: Não informada');
  });
});

describe('exportRelatorioPdf', () => {
  it('gera um PDF não vazio com o banco/competência informados', async () => {
    const buffer = await exportRelatorioPdf(fakeSession(), fakeItens());
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 0);
    assert.equal(buffer.slice(0, 4).toString('ascii'), '%PDF');
  });

  it('quebra em várias páginas sem erro quando há muitos lançamentos', async () => {
    const itens = Array.from({ length: 120 }, (_, i) => fakeItens()[i % 2]);
    const buffer = await exportRelatorioPdf(fakeSession(), itens);
    assert.equal(buffer.slice(0, 4).toString('ascii'), '%PDF');
    const pages = buffer.toString('latin1').match(/\/Type \/Page\b/g) || [];
    assert.ok(pages.length > 1, `esperava mais de 1 página, veio ${pages.length}`);
  });
});

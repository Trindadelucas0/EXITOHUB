import { describe, expect, it } from "vitest";
import { compareProduct, type DestinosCst, type FiscalRule, type ImportedProduct } from "./compare";
import { applyRuleValuesToProduct, resolveLinkedRule } from "./treated-apply";

const destStInterno: DestinosCst = {
  naoContribuinte: "0",
  contribuinte: "10",
  revenda: "10",
  construtora: "0",
  hospClinica: "0",
  orgaoPublico: "0",
  produtorRural: "0",
  atacado: "10",
};

const destWrong: DestinosCst = {
  naoContribuinte: "60",
  contribuinte: "60",
  revenda: "60",
  construtora: "60",
  hospClinica: "60",
  orgaoPublico: "60",
  produtorRural: "60",
  atacado: "60",
};

function rule(partial: Partial<FiscalRule> & { id: string }): FiscalRule {
  return {
    ncm: "32141010",
    ncmOriginal: "32141010",
    segmento: "Materiais",
    cstEntrada: "00",
    cstSaida: "10",
    cfopSaida: "5403",
    destinosCst: destStInterno,
    situacao: "ST INTERNO",
    situacaoCodigo: "ST_INTERNO",
    mvaPercentual: 41,
    mvaTexto: "41",
    mvaKind: "percent",
    ...partial,
  };
}

function product(partial: Partial<ImportedProduct> = {}): ImportedProduct {
  return {
    codigo: "P1",
    descricao: "Produto teste",
    ncm: "32141010",
    ncmOriginal: "32141010",
    cstCompra: "60",
    cstUnico: "60",
    ivaMva: "0",
    ivaMvaNumero: 0,
    destinosCst: destWrong,
    ...partial,
  };
}

describe("aplicar valores corretos ao tratar", () => {
  it("copia CST, MVA e destinos da regra", () => {
    const applied = applyRuleValuesToProduct(product(), rule({ id: "r1" }));
    expect(applied.cstCompra).toBe("00");
    expect(applied.cstUnico).toBe("10");
    expect(applied.ivaMva).toBe("41");
    expect(applied.ivaMvaNumero).toBe(41);
    expect(applied.destinosCst).toEqual(destStInterno);
  });

  it("Unica copia Abreviação, CEST e alíquota DF da regra", () => {
    const fiscal = rule({
      id: "u1",
      situacaoCodigo: "TRIBUTACAO_UF",
      situacao: "Tributação UF",
      cstEntrada: null,
      cstSaida: null,
      cfopSaida: null,
      destinosCst: {
        naoContribuinte: null,
        contribuinte: null,
        revenda: null,
        construtora: null,
        hospClinica: null,
        orgaoPublico: null,
        produtorRural: null,
        atacado: null,
      },
      mvaPercentual: 40,
      mvaTexto: "40",
      abreviacao: "4",
      cest: "24000200",
      ufTributacao: {
        DF: {
          original: "40",
          ajustada4: null,
          ajustada7: null,
          ajustada12: null,
          aliqInterna: "20%",
        },
        GO: {
          original: null,
          ajustada4: null,
          ajustada7: null,
          ajustada12: null,
          aliqInterna: null,
        },
        MG: {
          original: null,
          ajustada4: null,
          ajustada7: null,
          ajustada12: null,
          aliqInterna: null,
        },
      },
    });
    const applied = applyRuleValuesToProduct(
      product({
        destinosCst: null,
        abreviacao: "003",
        cest: "1301100",
        aliquotaIcms: "18",
      }),
      fiscal,
    );
    expect(applied.abreviacao).toBe("4");
    expect(applied.cest).toBe("24000200");
    expect(applied.aliquotaIcms).toBe("20%");
    expect(compareProduct(applied, [fiscal], null).status).toBe("CORRETO");
  });

  it("depois de aplicar, a conferência passa a CORRETO", () => {
    const fiscal = rule({ id: "r1" });
    const before = compareProduct(product(), [fiscal], null);
    expect(before.status).toBe("DIVERGENTE");
    const after = compareProduct(applyRuleValuesToProduct(product(), fiscal), [fiscal], null);
    expect(after.status).toBe("CORRETO");
    expect(after.diffs).toEqual([]);
  });

  it("ST INTERNO com CST único vira CORRETO ao receber a matriz da regra", () => {
    const fiscal = rule({ id: "st" });
    const row = product({ destinosCst: null, cstUnico: "00" });
    expect(compareProduct(row, [fiscal], null).status).toBe("NECESSITA_ANALISE");
    const after = compareProduct(applyRuleValuesToProduct(row, fiscal), [fiscal], null);
    expect(after.status).toBe("CORRETO");
  });

  it("não escolhe regra sozinho quando o NCM tem duas hipóteses", () => {
    const st = rule({ id: "a", situacaoCodigo: "ST_NACIONAL" });
    const red = rule({ id: "b", situacaoCodigo: "REDUCAO", cstSaida: "20" });
    expect(resolveLinkedRule([st, red], null)).toBeNull();
    expect(resolveLinkedRule([st, red], "b")?.id).toBe("b");
    expect(resolveLinkedRule([st], null)?.id).toBe("a");
  });

  it("regra com destinos parciais copia a matriz completa ao tratar", () => {
    const parcial: DestinosCst = {
      naoContribuinte: null,
      contribuinte: null,
      revenda: "60",
      construtora: null,
      hospClinica: "60",
      orgaoPublico: null,
      produtorRural: null,
      atacado: "60",
    };
    const filled60: DestinosCst = {
      naoContribuinte: "60",
      contribuinte: "60",
      revenda: "60",
      construtora: "60",
      hospClinica: "60",
      orgaoPublico: "60",
      produtorRural: "60",
      atacado: "60",
    };
    const fiscal = rule({
      id: "st60",
      situacaoCodigo: "ST_NACIONAL",
      cstEntrada: "10",
      cstSaida: "60",
      cfopSaida: "5405",
      destinosCst: parcial,
      mvaPercentual: null,
      mvaTexto: "Não",
      mvaKind: "skip",
    });
    const applied = applyRuleValuesToProduct(product(), fiscal);
    expect(applied.destinosCst).toEqual(filled60);
    expect(applied.cstUnico).toBe("60");
    expect(compareProduct(applied, [fiscal], null).status).toBe("CORRETO");
  });

  it("Egaplast TRIBUTACAO_UF não copia MVA % no IVA do cadastro", () => {
    const fiscal = rule({
      id: "uf",
      ncm: "84818019",
      situacaoCodigo: "TRIBUTACAO_UF",
      cstEntrada: null,
      cstSaida: null,
      cfopSaida: null,
      destinosCst: {
        naoContribuinte: null,
        contribuinte: null,
        revenda: null,
        construtora: null,
        hospClinica: null,
        orgaoPublico: null,
        produtorRural: null,
        atacado: null,
      },
      mvaPercentual: 27.31,
      mvaTexto: "27.31%",
      cest: "23.002.00",
      ufTributacao: {
        DF: {
          original: "27.31%",
          ajustada4: null,
          ajustada7: null,
          ajustada12: null,
          aliqInterna: "20%",
        },
        GO: {
          original: null,
          ajustada4: null,
          ajustada7: null,
          ajustada12: null,
          aliqInterna: null,
        },
        MG: {
          original: null,
          ajustada4: null,
          ajustada7: null,
          ajustada12: null,
          aliqInterna: null,
        },
      },
    });
    const applied = applyRuleValuesToProduct(
      product({
        ncm: "84818019",
        destinosCst: null,
        ivaMva: "1.9424",
        ivaMvaNumero: 1.9424,
      }),
      fiscal,
      "egaplast",
    );
    expect(applied.ivaMva).toBe("1.9424");
    expect(applied.ivaMvaNumero).toBe(1.9424);
    expect(applied.cest).toBe("23.002.00");
  });
});

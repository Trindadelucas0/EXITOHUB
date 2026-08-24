import { describe, expect, it } from "vitest";
import { scoreParsedProducts, indexRulesByNcm } from "./import-score";
import type { FiscalRule } from "./compare";
import type { ParsedProduct } from "./import-cadastro";

const rule: FiscalRule = {
  id: "r1",
  ncm: "32091010",
  ncmOriginal: "32091010",
  segmento: "tinta",
  cstEntrada: "0",
  cstSaida: "0",
  cfopSaida: "5102",
  destinosCst: {
    naoContribuinte: "0",
    contribuinte: "0",
    revenda: "0",
    construtora: "0",
    hospClinica: "0",
    orgaoPublico: "0",
    produtorRural: "0",
    atacado: "0",
  },
  situacao: "Geral",
  situacaoCodigo: "GERAL",
  mvaPercentual: null,
  mvaTexto: null,
  mvaKind: "skip",
};

function product(partial: Partial<ParsedProduct>): ParsedProduct {
  return {
    codigo: "1",
    descricao: "TINTA",
    ncm: "32091010",
    ncmOriginal: "32091010",
    aliquotaIcms: null,
    ivaMva: null,
    ivaMvaNumero: null,
    cest: null,
    cstCompra: "0",
    cstUnico: "0",
    destinosCst: rule.destinosCst,
    ...partial,
  };
}

describe("score da importação", () => {
  it("grava status na linha e ignora lixo nos totais", () => {
    const { scored, totals } = scoreParsedProducts(
      [
        product({ codigo: "10", descricao: "TINTA OK" }),
        product({ codigo: "Filtros selecionados", descricao: "x", ncm: "" }),
      ],
      indexRulesByNcm([rule]),
    );
    expect(scored[0]?.auditStatus).toBe("CORRETO");
    expect(scored[1]?.auditStatus).toBeNull();
    expect(totals.total).toBe(1);
    expect(totals.corretos).toBe(1);
  });
});

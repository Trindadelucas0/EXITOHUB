import { describe, expect, it } from "vitest";
import { sheetItemFromPersisted } from "./audit";
import type { FiscalRule, ImportedProduct } from "./compare";

function product(partial: Partial<ImportedProduct> = {}): ImportedProduct & {
  id: string;
  auditStatus: string;
  auditMotivo: string;
  treatedAt: null;
  treatedStale: boolean;
  treatedNote: null;
} {
  return {
    id: "p1",
    codigo: "00001",
    descricao: "Produto teste",
    ncm: "30059090",
    ncmOriginal: "30059090",
    auditStatus: "DIVERGENTE",
    auditMotivo: "Cadastro Unica diverge da base fiscal deste NCM (Abreviação).",
    treatedAt: null,
    treatedStale: false,
    treatedNote: null,
    abreviacao: "003",
    cest: "1300100",
    aliquotaIcms: "18,00",
    ivaMva: "40",
    cstCompra: null,
    cstUnico: "0",
    destinosCst: null,
    ...partial,
  };
}

function unicaRule(partial: Partial<FiscalRule> = {}): FiscalRule {
  return {
    id: "r1",
    ncm: "30059090",
    ncmOriginal: "30059090",
    segmento: "Higiene",
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
    situacao: "Tributação por UF",
    situacaoCodigo: "TRIBUTACAO_UF",
    mvaPercentual: 40,
    mvaTexto: "40",
    mvaKind: "percent",
    cest: "1300100",
    abreviacao: "4",
    ufTributacao: {
      DF: {
        original: "40",
        ajustada4: null,
        ajustada7: null,
        ajustada12: null,
        aliqInterna: "18,00",
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
    ...partial,
  };
}

describe("sheetItemFromPersisted", () => {
  it("mapeia campos Unica no importado e na regra", () => {
    const item = sheetItemFromPersisted(product(), [unicaRule()], null);
    expect(item.situacaoCodigo).toBe("TRIBUTACAO_UF");
    expect(item.segmento).toBe("Higiene");
    expect(item.importado.abreviacao).toBe("003");
    expect(item.importado.cest).toBe("1300100");
    expect(item.importado.aliquotaIcms).toBe("18,00");
    expect(item.correto?.abreviacao).toBe("4");
    expect(item.correto?.cest).toBe("1300100");
    expect(item.correto?.aliquotaIcms).toBe("18,00");
    expect(item.correto?.mva).toBe("40");
  });

  it("sem regra deixa correto nulo", () => {
    const item = sheetItemFromPersisted(product(), [], null);
    expect(item.correto).toBeNull();
    expect(item.segmento).toBeNull();
    expect(item.importado.abreviacao).toBe("003");
  });
});

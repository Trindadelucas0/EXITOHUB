import { describe, expect, it } from "vitest";
import { buildEntradaGuide } from "./entrada";
import type { CompareResult } from "./compare";

const compareSemRegra: CompareResult = {
  status: "DIVERGENTE",
  motivo: "",
  diffs: [{ campo: "NCM", atual: "84439199", ideal: "NCM da base fiscal" }],
  rule: null,
  candidates: [],
  needsLink: false,
};

describe("buildEntradaGuide", () => {
  it("usa o nome da empresa ativa nas mensagens quando não há regra", () => {
    const guide = buildEntradaGuide(null, compareSemRegra, "84439199", {
      companyName: "Loja das Máquinas",
    });
    expect(guide?.cstSaida).toContain("aba Loja das Máquinas");
    expect(guide?.cstSaida).not.toContain("BAIFER");
    expect(guide?.alertaDivergencia).toContain("base fiscal de Loja das Máquinas");
  });

  it("mantém rótulo específico da Egaplast", () => {
    const guide = buildEntradaGuide(null, compareSemRegra, "84439199", {
      companyName: "Egaplast",
      companySlug: "Egaplast",
    });
    expect(guide?.cstSaida).toContain("base fiscal da Egaplast");
    expect(guide?.cstSaida).not.toContain("BAIFER");
  });

  it("Egaplast: IVA da entrada vem da regra CST+IVA, não do MVA % da TRIBUTACAO_UF", () => {
    const destinos = {
      naoContribuinte: null,
      contribuinte: null,
      revenda: null,
      construtora: null,
      hospClinica: null,
      orgaoPublico: null,
      produtorRural: null,
      atacado: null,
    };
    const trib = {
      id: "uf",
      ncm: "84818019",
      ncmOriginal: "84818019",
      segmento: "Plásticos",
      cstEntrada: null,
      cstSaida: null,
      cfopSaida: null,
      destinosCst: destinos,
      situacao: "Tributação por UF",
      situacaoCodigo: "TRIBUTACAO_UF",
      mvaPercentual: 27.31,
      mvaTexto: "27.31%",
      mvaKind: "numeric",
      ivaPorUf: null,
    };
    const st = {
      ...trib,
      id: "st",
      situacaoCodigo: "ST_INTERNO",
      situacao: "ST interno",
      cstSaida: "10",
      mvaPercentual: 1.9424,
      mvaTexto: "1.9424",
      ivaPorUf: { SP: "1.9424", AC: "1.4558" },
    };
    const compare: CompareResult = {
      status: "CORRETO",
      motivo: "",
      diffs: [],
      rule: trib,
      candidates: [trib, st],
      needsLink: false,
    };
    const guide = buildEntradaGuide(trib, compare, "84818019", {
      companyName: "Egaplast",
      companySlug: "Egaplast",
      origem: "9-PRODUÇÃO",
      cstUnico: "10",
    });
    expect(guide?.mva).toBe("1.9424");
    expect(guide?.mva).not.toContain("27.31");
  });

  it("Egaplast: sem mapa CST+IVA a entrada usa o IVA SIGNATÁRIO do cadastro", () => {
    const destinos = {
      naoContribuinte: null,
      contribuinte: null,
      revenda: null,
      construtora: null,
      hospClinica: null,
      orgaoPublico: null,
      produtorRural: null,
      atacado: null,
    };
    const trib = {
      id: "uf",
      ncm: "84818019",
      ncmOriginal: "84818019",
      segmento: "Plásticos",
      cstEntrada: null,
      cstSaida: null,
      cfopSaida: null,
      destinosCst: destinos,
      situacao: "Tributação por UF",
      situacaoCodigo: "TRIBUTACAO_UF",
      mvaPercentual: 27.31,
      mvaTexto: "27.31%",
      mvaKind: "numeric",
      ivaPorUf: null,
    };
    const compare: CompareResult = {
      status: "CORRETO",
      motivo: "",
      diffs: [],
      rule: trib,
      candidates: [trib],
      needsLink: false,
    };
    const guide = buildEntradaGuide(trib, compare, "84818019", {
      companyName: "Egaplast",
      companySlug: "Egaplast",
      origem: "9-PRODUÇÃO",
      cstUnico: "10",
      ivaPorUf: { SP: "1.9854", AC: "1.4558" },
    });
    expect(guide?.mva).toBe("1.9854");
    expect(guide?.mva).not.toContain("27.31");
  });
});

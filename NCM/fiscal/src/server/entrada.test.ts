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
});

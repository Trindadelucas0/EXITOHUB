import { describe, expect, it } from "vitest";
import { compareProduct, type DestinosCst, type FiscalRule, type ImportedProduct } from "./compare";

const dest0: DestinosCst = {
  naoContribuinte: "0",
  contribuinte: "0",
  revenda: "0",
  construtora: "0",
  hospClinica: "0",
  orgaoPublico: "0",
  produtorRural: "0",
  atacado: "0",
};

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

const dest60: DestinosCst = {
  naoContribuinte: "60",
  contribuinte: "60",
  revenda: "60",
  construtora: "60",
  hospClinica: "60",
  orgaoPublico: "60",
  produtorRural: "60",
  atacado: "60",
};

const destReducao: DestinosCst = {
  naoContribuinte: null,
  contribuinte: null,
  revenda: null,
  construtora: null,
  hospClinica: null,
  orgaoPublico: null,
  produtorRural: null,
  atacado: "20",
};

function rule(partial: Partial<FiscalRule> & { id: string }): FiscalRule {
  return {
    ncm: "32141010",
    ncmOriginal: "32141010",
    segmento: "Materiais",
    cstEntrada: "0",
    cstSaida: "0",
    cfopSaida: "5102",
    destinosCst: dest0,
    situacao: "",
    situacaoCodigo: "REGRA_GERAL",
    mvaPercentual: null,
    mvaTexto: null,
    mvaKind: "skip",
    ...partial,
  };
}

function product(partial: Partial<ImportedProduct> = {}): ImportedProduct {
  return {
    codigo: "P1",
    descricao: "Produto teste",
    ncm: "32141010",
    ncmOriginal: "32141010",
    destinosCst: dest0,
    ...partial,
  };
}

describe("motor de comparação", () => {
  it("CST 0 em todos → CORRETO se cadastro 00 em todos", () => {
    const result = compareProduct(
      product({ destinosCst: { ...dest0, revenda: "00" } }),
      [rule({ id: "r1" })],
      null,
    );
    expect(result.status).toBe("CORRETO");
  });

  it("ST INTERNO: 0 vs 10 nos destinos certos; Revenda 00 ou 60 → DIVERGENTE", () => {
    const st = rule({
      id: "st",
      cstSaida: "10",
      cfopSaida: "5403",
      situacaoCodigo: "ST_INTERNO",
      destinosCst: destStInterno,
    });
    const ok = compareProduct(product({ destinosCst: destStInterno }), [st], null);
    expect(ok.status).toBe("CORRETO");

    const revenda00 = compareProduct(
      product({ destinosCst: { ...destStInterno, revenda: "00" } }),
      [st],
      null,
    );
    expect(revenda00.status).toBe("DIVERGENTE");

    const todos60 = compareProduct(product({ destinosCst: dest60 }), [st], null);
    expect(todos60.status).toBe("DIVERGENTE");
  });

  it("ST NACIONAL: 60 em todos → CORRETO", () => {
    const nacional = rule({
      id: "n",
      ncm: "27101229",
      cstEntrada: null,
      cstSaida: "60",
      cfopSaida: "5405",
      situacaoCodigo: "ST_NACIONAL",
      destinosCst: dest60,
    });
    const result = compareProduct(
      product({ ncm: "27101229", destinosCst: dest60 }),
      [nacional],
      null,
    );
    expect(result.status).toBe("CORRETO");
  });

  it("REDUÇÃO: só Atacado preenchido entra na comparação", () => {
    const reducao = rule({
      id: "red",
      cstEntrada: "20",
      cstSaida: "20",
      situacaoCodigo: "REDUCAO",
      destinosCst: destReducao,
    });
    const ok = compareProduct(
      product({
        destinosCst: { ...destReducao, revenda: "0" },
        cstCompra: "20",
      }),
      [reducao],
      null,
    );
    expect(ok.status).toBe("CORRETO");

    const bad = compareProduct(
      product({ destinosCst: { ...destReducao, atacado: "0" }, cstCompra: "20" }),
      [reducao],
      null,
    );
    expect(bad.status).toBe("DIVERGENTE");
  });

  it("NCM duplicado sem vínculo → NECESSITA ANÁLISE; NCM vazio ou fora da base → DIVERGENTE", () => {
    const st = rule({ id: "a", situacaoCodigo: "ST_NACIONAL", cstSaida: "60", cfopSaida: "5405", destinosCst: dest60 });
    const red = rule({ id: "b", situacaoCodigo: "REDUCAO", cstSaida: "20", destinosCst: destReducao });
    expect(compareProduct(product(), [st, red], null).status).toBe("NECESSITA_ANALISE");
    const semNcm = compareProduct(product({ ncm: "", ncmOriginal: "" }), [st], null);
    expect(semNcm.status).toBe("DIVERGENTE");
    expect(semNcm.diffs[0]?.campo).toBe("NCM");
    const fora = compareProduct(product({ ncm: "99999999", ncmOriginal: "99999999" }), [], null);
    expect(fora.status).toBe("DIVERGENTE");
    expect(fora.diffs[0]?.campo).toBe("NCM");
  });

  it("vincular uma das duas regras permite comparar", () => {
    const st = rule({ id: "a", situacaoCodigo: "ST_NACIONAL", cstSaida: "60", cfopSaida: "5405", destinosCst: dest60 });
    const red = rule({ id: "b", situacaoCodigo: "REDUCAO", cstSaida: "20", destinosCst: destReducao });
    const result = compareProduct(product({ destinosCst: dest60 }), [st, red], "a");
    expect(result.status).toBe("CORRETO");
  });
});

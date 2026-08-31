import { describe, expect, it } from "vitest";
import {
  compareProduct,
  completeRuleDestinos,
  type DestinosCst,
  type FiscalRule,
  type ImportedProduct,
} from "./compare";

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

/** Como no print: só Revenda, Hosp e Atacado preenchidos com 60. */
const dest60Furado: DestinosCst = {
  naoContribuinte: null,
  contribuinte: null,
  revenda: "60",
  construtora: null,
  hospClinica: "60",
  orgaoPublico: null,
  produtorRural: null,
  atacado: "60",
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
    expect(ok.rule?.destinosCst).toEqual(destStInterno);

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

  it("ST NACIONAL com destinos furados completa com cstSaida e marca divergência", () => {
    const nacional = rule({
      id: "n",
      ncm: "27101229",
      cstEntrada: null,
      cstSaida: "60",
      cfopSaida: "5405",
      situacaoCodigo: "ST_NACIONAL",
      destinosCst: dest60Furado,
    });
    const completed = completeRuleDestinos(nacional);
    expect(completed.destinosCst).toEqual(dest60);

    const importadoParcial: DestinosCst = {
      naoContribuinte: "00",
      contribuinte: "60",
      revenda: "60",
      construtora: "00",
      hospClinica: "00",
      orgaoPublico: "00",
      produtorRural: "00",
      atacado: "60",
    };
    const result = compareProduct(
      product({ ncm: "27101229", destinosCst: importadoParcial }),
      [nacional],
      null,
    );
    expect(result.status).toBe("DIVERGENTE");
    expect(result.rule?.destinosCst).toEqual(dest60);
    expect(result.diffs.some((d) => d.campo === "Não contribuinte")).toBe(true);
    expect(result.diffs.some((d) => d.campo === "Hosp/clínica")).toBe(true);
  });

  it("REDUÇÃO: destinos vazios viram cstSaida e entram na comparação", () => {
    const reducao = rule({
      id: "red",
      cstEntrada: "20",
      cstSaida: "20",
      situacaoCodigo: "REDUCAO",
      destinosCst: destReducao,
    });
    const filled20: DestinosCst = {
      naoContribuinte: "20",
      contribuinte: "20",
      revenda: "20",
      construtora: "20",
      hospClinica: "20",
      orgaoPublico: "20",
      produtorRural: "20",
      atacado: "20",
    };
    expect(completeRuleDestinos(reducao).destinosCst).toEqual(filled20);

    const ok = compareProduct(
      product({
        destinosCst: filled20,
        cstCompra: "20",
      }),
      [reducao],
      null,
    );
    expect(ok.status).toBe("CORRETO");
    expect(ok.rule?.destinosCst).toEqual(filled20);

    const badRevenda = compareProduct(
      product({
        destinosCst: { ...filled20, revenda: "0" },
        cstCompra: "20",
      }),
      [reducao],
      null,
    );
    expect(badRevenda.status).toBe("DIVERGENTE");

    const badAtacado = compareProduct(
      product({ destinosCst: { ...filled20, atacado: "0" }, cstCompra: "20" }),
      [reducao],
      null,
    );
    expect(badAtacado.status).toBe("DIVERGENTE");
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

  it("Unica TRIBUTACAO_UF sem cadastro de CEST/alíquota → NECESSITA_ANALISE", () => {
    const unica = rule({
      id: "u1",
      situacaoCodigo: "TRIBUTACAO_UF",
      cstSaida: null,
      cfopSaida: null,
      cest: "24000200",
      ufTributacao: {
        DF: { original: "50%", ajustada4: null, ajustada7: null, ajustada12: null, aliqInterna: "20%" },
        GO: { original: "50%", ajustada4: null, ajustada7: null, ajustada12: null, aliqInterna: "19%" },
        MG: { original: "64.68%", ajustada4: null, ajustada7: null, ajustada12: null, aliqInterna: "18%" },
      },
    });
    const result = compareProduct(product({ destinosCst: null, cest: null, aliquotaIcms: null }), [unica], null);
    expect(result.status).toBe("NECESSITA_ANALISE");
    expect(result.motivo).toMatch(/CSV de produtos/i);
  });

  it("Unica compara CEST quando o cadastro traz CEST", () => {
    const unica = rule({
      id: "u1",
      situacaoCodigo: "TRIBUTACAO_UF",
      cstSaida: null,
      cfopSaida: null,
      cest: "24000200",
      ufTributacao: {
        DF: { original: "50%", ajustada4: null, ajustada7: null, ajustada12: null, aliqInterna: "20%" },
        GO: { original: null, ajustada4: null, ajustada7: null, ajustada12: null, aliqInterna: "19%" },
        MG: { original: null, ajustada4: null, ajustada7: null, ajustada12: null, aliqInterna: "18%" },
      },
    });
    const ok = compareProduct(
      product({ destinosCst: null, cest: "24.000.200", aliquotaIcms: "20%" }),
      [unica],
      null,
    );
    expect(ok.status).toBe("CORRETO");
    const bad = compareProduct(
      product({ destinosCst: null, cest: "1301100", aliquotaIcms: "20%" }),
      [unica],
      null,
    );
    expect(bad.status).toBe("DIVERGENTE");
    expect(bad.diffs.some((d) => d.campo === "CEST")).toBe(true);
  });
});

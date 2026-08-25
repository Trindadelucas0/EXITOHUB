import { describe, expect, it } from "vitest";
import {
  auditCounterDeltas,
  dashboardTotalsFromBatch,
  ncmSearchDigits,
  parseExportStatuses,
  parseProductListParams,
} from "./product-query";

describe("consulta paginada de produtos", () => {
  it("limita pageSize e ignora status inválido", () => {
    const params = parseProductListParams(
      new URL("http://local/api/products?page=0&pageSize=999&status=HACK&q=tinta"),
    );
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(100);
    expect(params.status).toBe("");
    expect(params.q).toBe("tinta");
  });

  it("aceita status fiscal e página", () => {
    const params = parseProductListParams(
      new URL("http://local/api/products?page=3&pageSize=25&status=DIVERGENTE&ncm=32.091.010"),
    );
    expect(params.page).toBe(3);
    expect(params.pageSize).toBe(25);
    expect(params.status).toBe("DIVERGENTE");
    expect(params.ncm).toBe("32091010");
    expect(params.tratado).toBe("");
  });

  it("aceita filtro de tratados", () => {
    const params = parseProductListParams(
      new URL("http://local/api/products?tratado=nao&status=DIVERGENTE"),
    );
    expect(params.tratado).toBe("nao");
  });

  it("corta sufixo TIPI no filtro NCM sem zerar parcial", () => {
    const comSufixo = parseProductListParams(
      new URL("http://local/api/products?ncm=73269090-1"),
    );
    expect(comSufixo.ncm).toBe("73269090");
    const parcial = parseProductListParams(new URL("http://local/api/products?ncm=7326"));
    expect(parcial.ncm).toBe("7326");
  });
});

describe("ncmSearchDigits", () => {
  it("remove máscara e sufixo TIPI sem pad à esquerda", () => {
    expect(ncmSearchDigits("73269090-1")).toBe("73269090");
    expect(ncmSearchDigits("82.03.20.10")).toBe("82032010");
    expect(ncmSearchDigits("7326")).toBe("7326");
  });
});

describe("filtro de exportação", () => {
  it("usa status quando válido", () => {
    expect(parseExportStatuses(new URL("http://local/api/export/excel?status=CORRETO"))).toEqual({
      statuses: ["CORRETO"],
      slug: "corretos",
    });
    expect(
      parseExportStatuses(new URL("http://local/api/export/pdf?status=NECESSITA_ANALISE")),
    ).toEqual({
      statuses: ["NECESSITA_ANALISE"],
      slug: "analise",
    });
  });

  it("mapeia somente e ignora valor inválido", () => {
    expect(parseExportStatuses(new URL("http://local/api/export/excel?somente=divergentes"))).toEqual({
      statuses: ["DIVERGENTE"],
      slug: "divergentes",
    });
    expect(parseExportStatuses(new URL("http://local/api/export/excel?somente=todos"))).toEqual({
      statuses: undefined,
      slug: "cadastro",
    });
    expect(parseExportStatuses(new URL("http://local/api/export/excel?somente=hacker"))).toEqual({
      statuses: undefined,
      slug: "cadastro",
    });
    expect(parseExportStatuses(new URL("http://local/api/export/excel"))).toEqual({
      statuses: undefined,
      slug: "cadastro",
    });
  });

  it("status válido prevalece sobre somente", () => {
    expect(
      parseExportStatuses(
        new URL("http://local/api/export/excel?status=CORRETO&somente=divergentes"),
      ),
    ).toEqual({
      statuses: ["CORRETO"],
      slug: "corretos",
    });
  });
});

describe("totais do panorama", () => {
  it("usa contadores do lote sem comparar produtos", () => {
    expect(dashboardTotalsFromBatch(null)).toEqual({
      total: 0,
      corretos: 0,
      divergentes: 0,
      analise: 0,
    });
    expect(
      dashboardTotalsFromBatch({
        totalRows: 1200,
        corretos: 800,
        divergentes: 300,
        analise: 100,
      }),
    ).toEqual({ total: 1200, corretos: 800, divergentes: 300, analise: 100 });
  });
});

describe("ajuste de contadores ao vincular regra", () => {
  it("troca CORRETO por DIVERGENTE", () => {
    expect(auditCounterDeltas("CORRETO", "DIVERGENTE")).toEqual({
      corretos: -1,
      divergentes: 1,
      analise: 0,
    });
  });

  it("primeira auditoria só incrementa o status novo", () => {
    expect(auditCounterDeltas(null, "NECESSITA_ANALISE")).toEqual({
      corretos: 0,
      divergentes: 0,
      analise: 1,
    });
  });
});

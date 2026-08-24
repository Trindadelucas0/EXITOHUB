import { describe, expect, it } from "vitest";
import {
  auditCounterDeltas,
  dashboardTotalsFromBatch,
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

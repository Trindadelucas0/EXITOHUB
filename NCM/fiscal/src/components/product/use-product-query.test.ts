import { describe, expect, it } from "vitest";
import { buildProductsUrl } from "./use-product-query";

describe("URL da consulta por planilha", () => {
  const filters = { q: "", ncm: "", segmento: "", status: "" as const, tratado: "" as const };

  it("envia lote na query para não misturar planilhas", () => {
    expect(buildProductsUrl(filters, "lote-x")).toBe("/api/products?lote=lote-x");
  });

  it("não envia lote vazio e preserva filtros", () => {
    expect(buildProductsUrl(filters, null)).toBe("/api/products");
    expect(buildProductsUrl({ q: "tinta", ncm: "", segmento: "", status: "DIVERGENTE", tratado: "" }, "lote-x")).toBe(
      "/api/products?q=tinta&status=DIVERGENTE&lote=lote-x",
    );
    expect(
      buildProductsUrl({ q: "", ncm: "", segmento: "", status: "DIVERGENTE", tratado: "nao" }, "lote-x"),
    ).toBe("/api/products?status=DIVERGENTE&tratado=nao&lote=lote-x");
    expect(
      buildProductsUrl({ q: "", ncm: "", segmento: "autopecas", status: "DIVERGENTE", tratado: "nao" }, "lote-x"),
    ).toBe("/api/products?segmento=autopecas&status=DIVERGENTE&tratado=nao&lote=lote-x");
  });

  it("envia página e tamanho só quando saem do padrão", () => {
    expect(buildProductsUrl(filters, "lote-x", 2, 50)).toBe(
      "/api/products?lote=lote-x&page=2&pageSize=50",
    );
    expect(buildProductsUrl(filters, "lote-x", 1, 25)).toBe("/api/products?lote=lote-x");
  });
});

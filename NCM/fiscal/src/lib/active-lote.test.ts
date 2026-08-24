import { describe, expect, it } from "vitest";
import { hrefWithLote } from "./active-lote";

describe("lote na navegação", () => {
  it("preserva o lote só nas páginas de cadastro", () => {
    expect(hrefWithLote("/consulta", "lote-1")).toBe("/consulta?lote=lote-1");
    expect(hrefWithLote("/dashboard", "lote-1")).toBe("/dashboard?lote=lote-1");
    expect(hrefWithLote("/divergencias", "abc")).toBe("/divergencias?lote=abc");
    expect(hrefWithLote("/importar", "lote-1")).toBe("/importar");
    expect(hrefWithLote("/consulta", null)).toBe("/consulta");
  });
});

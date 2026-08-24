import { describe, expect, it } from "vitest";
import { normalizeCst, normalizeNcm, parseMvaNumber } from "./ncm";

describe("normalizeNcm", () => {
  it("remove sufixo e máscara", () => {
    expect(normalizeNcm("82032010-2")).toBe("82032010");
    expect(normalizeNcm("82.03.20.10")).toBe("82032010");
  });

  it("completa zero à esquerda", () => {
    expect(normalizeNcm("1012100")).toBe("01012100");
  });
});

describe("normalizeCst", () => {
  it("trata 00 como 0", () => {
    expect(normalizeCst("00")).toBe("0");
    expect(normalizeCst("10")).toBe("10");
  });
});

describe("parseMvaNumber", () => {
  it("lê percentual brasileiro", () => {
    expect(parseMvaNumber("26,66%")).toBeCloseTo(26.66);
  });

  it("Não e vazio não viram número", () => {
    expect(parseMvaNumber("Não")).toBeNull();
    expect(parseMvaNumber("")).toBeNull();
  });
});

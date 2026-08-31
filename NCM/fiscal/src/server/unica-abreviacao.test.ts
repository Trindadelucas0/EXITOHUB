import { describe, expect, it } from "vitest";
import { fillMissingUnicaAbreviacao, unicaAbreviacaoByNcm } from "./unica-abreviacao";

describe("abreviacao oficial Unica", () => {
  it("indexa NCM da base Atacadista", () => {
    const map = unicaAbreviacaoByNcm();
    expect(map.get("25202090")).toBe("4");
    expect(map.get("27101230")).toBe("3");
    expect(map.get("27150000")).toBe("2");
    expect(map.size).toBe(125);
  });

  it("preenche só quando abreviacao veio undefined", () => {
    const filled = fillMissingUnicaAbreviacao([
      { ncm: "25202090", abreviacao: undefined },
      { ncm: "25202090", abreviacao: "9" },
      { ncm: "25202090", abreviacao: null },
      { ncm: "99999999", abreviacao: undefined },
    ]);
    expect(filled[0]?.abreviacao).toBe("4");
    expect(filled[1]?.abreviacao).toBe("9");
    expect(filled[2]?.abreviacao).toBeNull();
    expect(filled[3]?.abreviacao).toBeUndefined();
  });
});

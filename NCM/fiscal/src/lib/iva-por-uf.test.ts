import { describe, expect, it } from "vitest";
import {
  EGAPLAST_IVA_UF_KEYS,
  asIvaPorUf,
  ivaCellsDiverge,
  ivaPorUfDiffs,
  parseIvaFactor,
} from "./iva-por-uf";

describe("IVA/ICMS por UF Egaplast", () => {
  it("tem 27 UFs na ordem da print (última linha com 6)", () => {
    expect(EGAPLAST_IVA_UF_KEYS).toHaveLength(27);
    expect(EGAPLAST_IVA_UF_KEYS[0]).toBe("AC");
    expect(EGAPLAST_IVA_UF_KEYS.at(-1)).toBe("TO");
    expect(EGAPLAST_IVA_UF_KEYS.filter((uf) => uf === "SP")).toEqual(["SP"]);
  });

  it("1.9424 vs 27.31 é outra unidade — não usa este helper para %", () => {
    expect(parseIvaFactor("1.9424")).toBeCloseTo(1.9424, 4);
    expect(ivaCellsDiverge("1.9", "1.955")).toBe(true);
    expect(ivaCellsDiverge("1.955", "1.9551")).toBe(false);
    expect(ivaCellsDiverge("1.9424", "1.9424")).toBe(false);
  });

  it("lista só UFs que realmente divergem", () => {
    const atual = asIvaPorUf({ SP: "1.9", MG: "1.58", AC: "0" });
    const ideal = asIvaPorUf({ SP: "1.955", MG: "1.58", AC: "0" });
    const diffs = ivaPorUfDiffs(atual, ideal);
    expect(diffs.map((d) => d.uf)).toEqual(["SP"]);
  });
});

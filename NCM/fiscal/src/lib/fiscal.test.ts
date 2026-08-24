import { describe, expect, it } from "vitest";
import { cstCellsDiverge, displayCst, labelCampoFiscal } from "./fiscal";

describe("rótulos da divergência", () => {
  it("traduz CST da empresa e CST de compra para o relatório", () => {
    expect(labelCampoFiscal("CST BAIFER")).toBe("CST da empresa (saída)");
    expect(labelCampoFiscal("CST compra / nota de entrada")).toBe("CST de compra (entrada)");
    expect(labelCampoFiscal("Revenda")).toBe("Revenda");
  });

  it("marca célula divergente na grade", () => {
    expect(cstCellsDiverge("00", "10")).toBe(true);
    expect(cstCellsDiverge("0", "00")).toBe(false);
    expect(cstCellsDiverge("", "10")).toBe(true);
    expect(displayCst(null)).toBe("—");
  });
});

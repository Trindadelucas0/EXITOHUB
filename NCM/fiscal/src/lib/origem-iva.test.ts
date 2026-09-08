import { describe, expect, it } from "vitest";
import { classifyOrigemIva, ivaIdealForOrigem, ivaIdealFromRules, ivaIdealForDisplay, origemIvaLabel } from "./origem-iva";

describe("origem IVA Egaplast", () => {
  it("0 e 9 são nacional; 1 e 2 são importado", () => {
    expect(classifyOrigemIva("0-NACIONAL")).toBe("nacional");
    expect(classifyOrigemIva("9-PRODUÇÃO")).toBe("nacional");
    expect(classifyOrigemIva("1-ESTRANGEIRA")).toBe("importado");
    expect(classifyOrigemIva("2-ESTRANGEIRA ADQUIRIDA")).toBe("importado");
  });

  it("escolhe o mapa da origem e cai no outro se faltar", () => {
    const rule = {
      ivaPorUf: { SP: "1.9424" },
      ivaPorUfImportado: { SP: "2.119" },
    };
    expect(ivaIdealForOrigem(rule, "0-NACIONAL")?.SP).toBe("1.9424");
    expect(ivaIdealForOrigem(rule, "1-ESTRANGEIRA")?.SP).toBe("2.119");
    expect(ivaIdealForOrigem({ ivaPorUf: { SP: "1.9424" } }, "1-ESTRANGEIRA")?.SP).toBe("1.9424");
  });

  it("se TRIBUTACAO_UF não tem IVA, usa a irmã CST+IVA do NCM", () => {
    expect(
      ivaIdealFromRules(
        { cstSaida: null, ivaPorUf: null },
        [{ cstSaida: "10", ivaPorUf: { SP: "1.9424", AC: "1.4558" } }],
        "9-PRODUÇÃO",
        "10",
      )?.SP,
    ).toBe("1.9424");
    expect(
      ivaIdealFromRules(
        { cstSaida: null, ivaPorUf: null },
        [{ cstSaida: "10", ivaPorUf: { SP: "1.9424" } }],
        "9-PRODUÇÃO",
        "10",
      )?.AC,
    ).toBeUndefined();
  });

  it("Como deve ficar usa o IVA do cadastro se a base não tiver mapa", () => {
    expect(
      ivaIdealForDisplay(
        { cstSaida: null, ivaPorUf: null },
        [],
        "9-PRODUÇÃO",
        "10",
        { SP: "1.9854", AC: "1.4558" },
      )?.SP,
    ).toBe("1.9854");
    expect(
      ivaIdealForDisplay(
        { cstSaida: null, ivaPorUf: null },
        [{ cstSaida: "10", ivaPorUf: { SP: "1.9424", AC: "1.4558" } }],
        "9-PRODUÇÃO",
        "10",
        { SP: "1.9854" },
      )?.SP,
    ).toBe("1.9424");
  });

  it("rótulo curto para a ficha", () => {
    expect(origemIvaLabel("0-NACIONAL").short).toBe("Nacional");
    expect(origemIvaLabel("1-ESTRANGEIRA").short).toBe("Importado");
    expect(origemIvaLabel("9-PRODUÇÃO").short).toBe("Produção (nacional)");
  });
});

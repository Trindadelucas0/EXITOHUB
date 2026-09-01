import { describe, expect, it } from "vitest";
import { classifyOrigemIva, ivaIdealForOrigem, origemIvaLabel } from "./origem-iva";

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

  it("rótulo curto para a ficha", () => {
    expect(origemIvaLabel("0-NACIONAL").short).toBe("Nacional");
    expect(origemIvaLabel("1-ESTRANGEIRA").short).toBe("Importado");
    expect(origemIvaLabel("9-PRODUÇÃO").short).toBe("Produção (nacional)");
  });
});

import { describe, expect, it } from "vitest";
import { ncmCapituloCodigo, ncmCapituloLabel } from "./ncm-capitulo";

describe("capítulo NCM Egaplast", () => {
  it("mapeia 39 e 84 pelos dois primeiros dígitos", () => {
    expect(ncmCapituloCodigo("39172900")).toBe("39");
    expect(ncmCapituloLabel("39172900")).toBe("Plásticos e suas obras");
    expect(ncmCapituloLabel("84818019")).toBe("Máquinas e aparelhos mecânicos");
  });

  it("usa fallback para capítulo sem nome cadastrado", () => {
    expect(ncmCapituloLabel("01012100")).toBe("Capítulo 01");
  });
});

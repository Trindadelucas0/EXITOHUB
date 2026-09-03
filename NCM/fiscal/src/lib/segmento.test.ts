import { describe, expect, it } from "vitest";
import {
  SEGMENTO_FORA,
  SEGMENTO_VAZIO,
  canonicalSegmentoName,
  foldSegmento,
  ncmFilterForSegmento,
  parseSegmentoParam,
  segmentoIdFromRule,
  segmentoLabel,
} from "@/src/lib/segmento";

describe("segmento Unica", () => {
  it("normaliza caixa, acento e espaços", () => {
    expect(foldSegmento("Tintas e vernizes")).toBe("tintas e vernizes");
    expect(foldSegmento("tintas e vernizes")).toBe("tintas e vernizes");
    expect(foldSegmento("  Materiais de construção e congêneres ")).toBe(
      "materiais de construcao e congeneres",
    );
    expect(segmentoIdFromRule("")).toBe(SEGMENTO_VAZIO);
    expect(segmentoIdFromRule("Autopeças")).toBe("autopecas");
  });

  it("agrupa NCMs da regra e reserva fora da base", () => {
    const rules = [
      { ncm: "84242000", segmento: "Autopeças" },
      { ncm: "32041700", segmento: "Tintas e vernizes" },
      { ncm: "32089010", segmento: "tintas e vernizes" },
      { ncm: "27150000", segmento: "" },
    ];
    expect(ncmFilterForSegmento(rules, "autopecas").ncms).toEqual(["84242000"]);
    expect(ncmFilterForSegmento(rules, "Tintas e vernizes").ncms.sort()).toEqual([
      "32041700",
      "32089010",
    ]);
    expect(ncmFilterForSegmento(rules, SEGMENTO_VAZIO)).toEqual({
      mode: "in",
      ncms: ["27150000"],
    });
    expect(ncmFilterForSegmento(rules, SEGMENTO_FORA)).toEqual({
      mode: "notIn",
      ncms: ["84242000", "32041700", "32089010", "27150000"],
    });
    expect(ncmFilterForSegmento([], SEGMENTO_FORA)).toEqual({ mode: "notIn", ncms: [] });
  });

  it("rótulos oficiais e nome canônico pela grafia mais comum", () => {
    expect(segmentoLabel(SEGMENTO_FORA)).toBe("Fora da base");
    expect(segmentoLabel(SEGMENTO_VAZIO)).toBe("Sem segmento");
    expect(canonicalSegmentoName(["tintas e vernizes", "Tintas e vernizes", "Tintas e vernizes"])).toBe(
      "Tintas e vernizes",
    );
    expect(parseSegmentoParam("  Autopeças  ")).toBe("Autopeças");
    expect(parseSegmentoParam("")).toBe("");
  });
});

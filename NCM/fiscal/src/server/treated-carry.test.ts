import { describe, expect, it } from "vitest";
import { carryTreatedMarker, indexPreviousMarkers } from "./treated-carry";

const previous = indexPreviousMarkers([
  {
    codigo: "204.834",
    auditStatus: "DIVERGENTE",
    treatedAt: new Date("2026-08-01"),
    treatedByUserId: "user-1",
    treatedNote: "ajustado no Santri",
  },
]);

describe("cópia de já tratado", () => {
  it("não copia se a flag estiver desligada", () => {
    expect(carryTreatedMarker(false, "204.834", "DIVERGENTE", previous).treatedAt).toBeNull();
  });

  it("não copia se o item ficou correto", () => {
    expect(carryTreatedMarker(true, "204.834", "CORRETO", previous).treatedAt).toBeNull();
  });

  it("copia e marca stale quando a situação mudou", () => {
    const carried = carryTreatedMarker(true, "204.834", "NECESSITA_ANALISE", previous);
    expect(carried.treatedAt).not.toBeNull();
    expect(carried.treatedStale).toBe(true);
    expect(carried.treatedByUserId).toBe("user-1");
  });

  it("copia sem stale se o status for o mesmo", () => {
    const carried = carryTreatedMarker(true, "204.834", "DIVERGENTE", previous);
    expect(carried.treatedStale).toBe(false);
    expect(carried.treatedNote).toBe("ajustado no Santri");
  });
});

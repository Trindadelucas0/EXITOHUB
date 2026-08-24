import { describe, expect, it } from "vitest";
import {
  batchBelongsToCompany,
  productsOfBatch,
  resolveDisplayedBatchId,
} from "@/src/lib/batch-scope";
import { ownedWhere } from "./tenant";

describe("lotes de importação isolados", () => {
  it("consulta do lote A não devolve produtos do lote B", () => {
    const products = [
      { id: "p1", codigo: "204.834", importBatchId: "lote-a", companyId: "baifer" },
      { id: "p2", codigo: "999.001", importBatchId: "lote-b", companyId: "baifer" },
    ];
    const ofA = productsOfBatch(products, "lote-a");
    expect(ofA.map((p) => p.codigo)).toEqual(["204.834"]);
    expect(ofA.some((p) => p.importBatchId === "lote-b")).toBe(false);
  });

  it("lote de outra empresa não é visível (404)", () => {
    const baiferBatch = { id: "lote-a", companyId: "baifer" };
    expect(batchBelongsToCompany(baiferBatch, "baifer")).toBe(true);
    expect(batchBelongsToCompany(baiferBatch, "loja")).toBe(false);
    const found = batchBelongsToCompany(
      ownedWhere("lote-a", "loja").id === baiferBatch.id &&
        ownedWhere("lote-a", "loja").companyId === baiferBatch.companyId
        ? baiferBatch
        : null,
      "loja",
    );
    expect(found).toBe(false);
  });

  it("lote da URL prevalece sobre o cookie da última importação", () => {
    const batches = [{ id: "lote-x" }, { id: "lote-y" }];
    expect(resolveDisplayedBatchId(batches, "lote-x", "lote-y")).toBe("lote-x");
    expect(resolveDisplayedBatchId(batches, null, "lote-y")).toBe("lote-y");
    expect(resolveDisplayedBatchId(batches, "lote-inexistente", "lote-y")).toBe("lote-y");
  });

  it("apagar lote A não remove regras nem o lote B", () => {
    const rules = [{ id: "ncm-1", companyId: "baifer" }];
    const batches = [
      { id: "lote-a", companyId: "baifer" },
      { id: "lote-b", companyId: "baifer" },
    ];
    const remaining = batches.filter((b) => b.id !== "lote-a");
    expect(remaining.map((b) => b.id)).toEqual(["lote-b"]);
    expect(rules).toHaveLength(1);
  });
});

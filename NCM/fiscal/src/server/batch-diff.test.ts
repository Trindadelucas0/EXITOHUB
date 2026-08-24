import { describe, expect, it } from "vitest";
import { diffBatchRows, filterDiffItems } from "./batch-diff";

describe("diff entre lotes", () => {
  it("classifica novo, saiu, NCM e situação", () => {
    const { items, summary } = diffBatchRows(
      [
        { codigo: "A", ncm: "1", auditStatus: "CORRETO" },
        { codigo: "B", ncm: "9", auditStatus: "DIVERGENTE" },
        { codigo: "C", ncm: "1", auditStatus: "DIVERGENTE" },
        { codigo: "D", ncm: "1", auditStatus: "CORRETO" },
      ],
      [
        { codigo: "B", ncm: "1", auditStatus: "DIVERGENTE" },
        { codigo: "C", ncm: "1", auditStatus: "CORRETO" },
        { codigo: "D", ncm: "1", auditStatus: "CORRETO" },
        { codigo: "E", ncm: "1", auditStatus: "DIVERGENTE" },
      ],
    );
    expect(summary).toEqual({
      added: 1,
      removed: 1,
      ncmChanged: 1,
      statusChanged: 1,
      unchanged: 1,
    });
    expect(filterDiffItems(items, "").map((item) => item.kind).sort()).toEqual(
      ["added", "ncm_changed", "removed", "status_changed"].sort(),
    );
    expect(items.find((item) => item.kind === "added")?.codigo).toBe("A");
    expect(items.find((item) => item.kind === "removed")?.codigo).toBe("E");
  });
});

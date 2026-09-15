import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  emptyDashboardBreakdown,
  foldNcmStatusCounts,
  rankAttentionNcm,
  statusPercents,
} from "@/src/lib/dashboard-metrics";

describe("totais e ranking do panorama", () => {
  it("lote vazio zera breakdown e preserva ruleCount", () => {
    expect(emptyDashboardBreakdown(12)).toEqual({
      totals: { total: 0, corretos: 0, divergentes: 0, analise: 0 },
      ruleCount: 12,
      treatedCount: 0,
      untreatedAttention: 0,
      topNcm: [],
      segmento: null,
      hasCadastro: false,
      batch: null,
    });
  });

  it("agrupa os três status por NCM", () => {
    const groups = foldNcmStatusCounts([
      { ncm: "84818019", auditStatus: "CORRETO", count: 38 },
      { ncm: "84818019", auditStatus: "DIVERGENTE", count: 40 },
      { ncm: "84818019", auditStatus: "NECESSITA_ANALISE", count: 2 },
      { ncm: "40129090", auditStatus: "DIVERGENTE", count: 18 },
    ]);
    expect(groups).toEqual([
      { ncm: "84818019", total: 80, corretos: 38, divergentes: 40, analise: 2 },
      { ncm: "40129090", total: 18, corretos: 0, divergentes: 18, analise: 0 },
    ]);
  });

  it("ordena por divergente+análise e limita a 8, ignorando só-corretos", () => {
    const groups = Array.from({ length: 12 }, (_, index) => ({
      ncm: String(10000000 + index),
      total: 10 + index,
      corretos: 10,
      divergentes: index === 0 ? 0 : index,
      analise: index === 0 ? 0 : 1,
    }));
    const ranked = rankAttentionNcm(groups, 8);
    expect(ranked).toHaveLength(8);
    expect(ranked[0]?.ncm).toBe("10000011");
    expect(ranked.some((row) => row.ncm === "10000000")).toBe(false);
  });

  it("percentuais dos três status somam 100 no lote", () => {
    expect(
      statusPercents({ total: 1200, corretos: 800, divergentes: 300, analise: 100 }),
    ).toEqual({ analisados: 100, corretos: 67, divergentes: 25, analise: 8 });
    expect(statusPercents({ total: 0, corretos: 0, divergentes: 0, analise: 0 })).toEqual({
      analisados: 0,
      corretos: 0,
      divergentes: 0,
      analise: 0,
    });
  });
});

describe("rota do panorama não compara o cadastro", () => {
  it("GET /api/dashboard usa breakdown agregado", () => {
    const route = readFileSync(path.join(process.cwd(), "app/api/dashboard/route.ts"), "utf8");
    const src = readFileSync(path.join(process.cwd(), "src/server/dashboard-breakdown.ts"), "utf8");
    expect(route).toContain("loadDashboardBreakdown");
    expect(route).not.toContain("compareCompanyProducts");
    expect(src).not.toContain("compareCompanyProducts");
    expect(src).toContain("dashboardTotalsFromBatch");
    expect(src).toContain("DASHBOARD_RANK_LIMIT");
  });
});

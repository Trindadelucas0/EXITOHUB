import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("rotas leves do Panorama", () => {
  it("dashboard não compara o cadastro inteiro", () => {
    const src = readFileSync(path.join(process.cwd(), "app/api/dashboard/route.ts"), "utf8");
    expect(src).not.toContain("compareCompanyProducts");
    expect(src).toContain("dashboardTotalsFromBatch");
  });

  it("consulta não remonta a página ao gravar o lote na URL", () => {
    const src = readFileSync(path.join(process.cwd(), "src/components/product/product-catalog.tsx"), "utf8");
    expect(src).not.toContain("router.replace");
    expect(src).toContain("useActiveBatch");
  });

  it("página do Panorama não carrega a grade de produtos", () => {
    const page = readFileSync(path.join(process.cwd(), "app/(office)/dashboard/page.tsx"), "utf8");
    expect(page).not.toContain("ProductCatalog");
    expect(page).toContain("KpiDashboard");
  });

  it("lista de lotes não faz consulta extra de lote ativo", () => {
    const src = readFileSync(path.join(process.cwd(), "app/api/import/route.ts"), "utf8");
    const getHandler = src.split("export async function GET")[1] ?? "";
    expect(getHandler).toContain("resolveDisplayedBatchId");
    expect(getHandler).not.toContain("resolveActiveBatch");
  });

  it("marcar tratado aplica valores corretos no servidor", () => {
    const one = readFileSync(path.join(process.cwd(), "app/api/products/[id]/treated/route.ts"), "utf8");
    const ncm = readFileSync(path.join(process.cwd(), "app/api/products/treated-ncm/route.ts"), "utf8");
    expect(one).toContain("markProductsTreated");
    expect(ncm).toContain("markProductsTreated");
  });

  it("GET /api/import não recalcula resumo de lote", () => {
    const src = readFileSync(path.join(process.cwd(), "app/api/import/route.ts"), "utf8");
    const getHandler = src.split("export async function GET")[1] ?? "";
    expect(getHandler).not.toContain("persistBatchSummary");
    expect(src).not.toContain("persistBatchSummary");
    expect(src).toContain("scoreParsedProducts");
    expect(src).toContain("listImportBatches");
  });
});

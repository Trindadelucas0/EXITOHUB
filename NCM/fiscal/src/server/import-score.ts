import { compareProduct, summarizeStatus, type FiscalRule, type ImportedProduct } from "./compare";
import { isJunkRow, type ParsedProduct } from "./import-cadastro";

export type ScoredImportRow = ParsedProduct & {
  auditStatus: string | null;
  auditMotivo: string | null;
};

export function indexRulesByNcm(rules: FiscalRule[]): Map<string, FiscalRule[]> {
  const rulesByNcm = new Map<string, FiscalRule[]>();
  for (const rule of rules) {
    const list = rulesByNcm.get(rule.ncm) ?? [];
    list.push(rule);
    rulesByNcm.set(rule.ncm, list);
  }
  return rulesByNcm;
}

export function scoreParsedProducts(
  products: ParsedProduct[],
  rulesByNcm: Map<string, FiscalRule[]>,
): { scored: ScoredImportRow[]; totals: ReturnType<typeof summarizeStatus> } {
  const compares: ReturnType<typeof compareProduct>[] = [];
  const scored = products.map((product) => {
    if (isJunkRow(product.codigo, product.descricao)) {
      return { ...product, auditStatus: null, auditMotivo: null };
    }
    const imported: ImportedProduct = product;
    const compare = compareProduct(imported, rulesByNcm.get(product.ncm) ?? [], null);
    compares.push(compare);
    return {
      ...product,
      auditStatus: compare.status,
      auditMotivo: compare.motivo,
    };
  });
  return { scored, totals: summarizeStatus(compares) };
}

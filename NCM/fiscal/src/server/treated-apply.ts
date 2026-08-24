import type { FiscalRule, ImportedProduct } from "./compare";

export function resolveLinkedRule(
  rulesForNcm: FiscalRule[],
  linkedRuleId: string | null,
): FiscalRule | null {
  return (
    rulesForNcm.find((item) => item.id === linkedRuleId) ??
    (rulesForNcm.length === 1 ? rulesForNcm[0] : null)
  );
}

export function applyRuleValuesToProduct(
  product: ImportedProduct,
  rule: FiscalRule,
): ImportedProduct {
  return {
    ...product,
    cstCompra: rule.cstEntrada,
    cstUnico: rule.cstSaida,
    destinosCst: { ...rule.destinosCst },
    ivaMva: rule.mvaPercentual != null ? String(rule.mvaPercentual) : rule.mvaTexto,
    ivaMvaNumero: rule.mvaPercentual,
  };
}

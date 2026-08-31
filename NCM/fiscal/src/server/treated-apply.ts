import { completeRuleDestinos, type FiscalRule, type ImportedProduct } from "./compare";

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
  const completed = completeRuleDestinos(rule);
  const unica = rule.situacaoCodigo === "TRIBUTACAO_UF" || Boolean(rule.ufTributacao);
  return {
    ...product,
    cstCompra: completed.cstEntrada,
    cstUnico: completed.cstSaida,
    destinosCst: { ...completed.destinosCst },
    ivaMva: completed.mvaPercentual != null ? String(completed.mvaPercentual) : completed.mvaTexto,
    ivaMvaNumero: completed.mvaPercentual,
    ...(unica
      ? {
          abreviacao: completed.abreviacao ?? product.abreviacao,
          cest: completed.cest ?? product.cest,
          aliquotaIcms: completed.ufTributacao?.DF.aliqInterna ?? product.aliquotaIcms,
        }
      : {}),
  };
}

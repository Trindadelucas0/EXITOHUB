import { completeRuleDestinos, type FiscalRule, type ImportedProduct } from "./compare";
import { isEgaplastCompany } from "./company-slug";
import { emptyDestinos } from "./rule-classify";

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
  companySlug?: string | null,
): ImportedProduct {
  if (isEgaplastCompany(companySlug)) {
    const unica = rule.situacaoCodigo === "TRIBUTACAO_UF" || Boolean(rule.ufTributacao);
    if (unica) {
      return {
        ...product,
        ivaMva: rule.mvaPercentual != null ? String(rule.mvaPercentual) : rule.mvaTexto,
        ivaMvaNumero: rule.mvaPercentual,
        cest: rule.cest ?? product.cest,
        aliquotaIcms: rule.ufTributacao?.DF.aliqInterna ?? product.aliquotaIcms,
      };
    }
    return {
      ...product,
      cstUnico: rule.cstSaida,
      destinosCst: product.destinosCst ?? emptyDestinos(),
      ivaMva: rule.mvaPercentual != null ? String(rule.mvaPercentual) : rule.mvaTexto,
      ivaMvaNumero: rule.mvaPercentual,
    };
  }
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

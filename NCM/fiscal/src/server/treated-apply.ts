import { completeRuleDestinos, type FiscalRule, type ImportedProduct } from "./compare";
import { isEgaplastCompany } from "./company-slug";
import { hasFilledIvaPorUf, parseIvaFactor } from "@/src/lib/iva-por-uf";
import { ivaIdealForOrigem } from "@/src/lib/origem-iva";
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
    if (unica && !hasFilledIvaPorUf(rule.ivaPorUf)) {
      return {
        ...product,
        cest: rule.cest ?? product.cest,
        aliquotaIcms: rule.ufTributacao?.DF.aliqInterna ?? product.aliquotaIcms,
      };
    }
    const ivaIdeal = ivaIdealForOrigem(rule, product.origem);
    return {
      ...product,
      cstUnico: rule.cstSaida ?? product.cstUnico,
      destinosCst: product.destinosCst ?? emptyDestinos(),
      ivaMva: ivaIdeal?.SP ?? (rule.mvaPercentual != null ? String(rule.mvaPercentual) : rule.mvaTexto ?? product.ivaMva),
      ivaMvaNumero: parseIvaFactor(ivaIdeal?.SP) ?? rule.mvaPercentual ?? product.ivaMvaNumero,
      ivaPorUf: ivaIdeal ?? product.ivaPorUf,
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

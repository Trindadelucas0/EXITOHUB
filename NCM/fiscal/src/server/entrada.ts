import "server-only";

import type { CompareResult, FiscalRule } from "./compare";
import { DESTINO_KEYS, DESTINO_LABELS } from "@/src/lib/fiscal";
import { ivaIdealForOrigem } from "@/src/lib/origem-iva";
import { isEgaplastCompany } from "./company-slug";

export type EntradaGuide = {
  ncm: string;
  situacao: string;
  cstEntrada: string;
  cstSaida: string;
  cfopSaida: string;
  mva: string;
  cfopEntradaNota: string;
  destaqueStInterno: string | null;
  checklist: string[];
  alertaDivergencia: string | null;
  matriz: { destino: string; cst: string }[];
};

export type EntradaGuideOptions = {
  companySlug?: string | null;
  companyName?: string | null;
  origem?: string | null;
};

function resolveCompanyName(options: EntradaGuideOptions): string {
  return (options.companyName ?? options.companySlug)?.trim() || "da empresa";
}

function rulesSheetLabel(options: EntradaGuideOptions, egaplast: boolean): string {
  if (egaplast) return "base fiscal da Egaplast";
  return `aba ${resolveCompanyName(options)}`;
}

function fiscalBaseLabel(options: EntradaGuideOptions, egaplast: boolean): string {
  if (egaplast) return "base fiscal da Egaplast";
  return `base fiscal de ${resolveCompanyName(options)}`;
}

function formatEgaplastIva(rule: FiscalRule, origem?: string | null): string {
  const ideal = ivaIdealForOrigem(rule, origem);
  if (ideal?.SP) return String(ideal.SP);
  if (rule.mvaTexto) return rule.mvaTexto;
  if (rule.mvaPercentual != null && rule.mvaPercentual < 10) return String(rule.mvaPercentual);
  if (rule.situacaoCodigo === "TRIBUTACAO_UF" || rule.ufTributacao) {
    return "não se aplica nesta tributação (NCM/CEST)";
  }
  return rule.mvaPercentual != null ? String(rule.mvaPercentual) : "não se aplica / vazio";
}

export function buildEntradaGuide(
  rule: FiscalRule | null,
  compare: CompareResult,
  ncmAtual?: string,
  options: EntradaGuideOptions = {},
): EntradaGuide | null {
  const egaplast = isEgaplastCompany(options.companySlug ?? options.companyName);
  const sheetLabel = rulesSheetLabel(options, egaplast);
  const baseLabel = fiscalBaseLabel(options, egaplast);

  if (!rule) {
    return {
      ncm: ncmAtual || "—",
      situacao: "NCM do cadastro inválido ou ausente",
      cstEntrada: `indisponível até o NCM estar na ${sheetLabel}`,
      cstSaida: `indisponível até o NCM estar na ${sheetLabel}`,
      cfopSaida: `indisponível até o NCM estar na ${sheetLabel}`,
      mva: `indisponível até o NCM estar na ${sheetLabel}`,
      cfopEntradaNota: "corrija o NCM na Base fiscal antes de orientar a entrada",
      destaqueStInterno: null,
      checklist: egaplast
        ? [
            "Abrir a Base fiscal e localizar o NCM correto do produto",
            "A regra da Egaplast daquele NCM vale para todos os produtos com esse NCM",
            "Corrigir o NCM no cadastro do cliente",
            "Só então conferir CST, NCM e o bloco IVA/ICMS por UF na NF de entrada",
          ]
        : [
            "Abrir a Base fiscal e localizar o NCM correto do produto",
            `A regra da ${sheetLabel} daquele NCM vale para todos os produtos com esse NCM`,
            "Corrigir o NCM no cadastro do cliente",
            "Só então conferir CST, ICMS, ST/MVA e CEST na NF de entrada",
          ],
      alertaDivergencia:
        compare.motivo ||
        (egaplast
          ? "NCM do cliente está vazio ou não está na base fiscal da Egaplast. Sem o NCM certo, o cadastro fiscal inteiro fica errado."
          : `NCM do cliente está vazio ou não está na ${baseLabel}. Sem o NCM certo, o cadastro fiscal inteiro fica errado.`),
      matriz: [],
    };
  }

  if (egaplast) {
    return {
      ncm: rule.ncm,
      situacao: rule.situacao || rule.situacaoCodigo,
      cstEntrada: rule.cstEntrada ?? "não informado na base (não inventado)",
      cstSaida: rule.cstSaida ?? "não informado na base",
      cfopSaida: rule.cfopSaida ?? "não informado na base",
      mva: formatEgaplastIva(rule, options.origem),
      cfopEntradaNota: "conforme operação (dentro/fora do estado) — CFOP de entrada não está na base",
      destaqueStInterno: null,
      checklist: [
        "Conferir NCM na NF do fornecedor",
        "Conferir origem e CST da nota de entrada",
        "Conferir o bloco IVA/ICMS das 27 UFs quando a base for CST+IVA",
        "Conferir CEST somente se constar no cadastro ou na NF",
      ],
      alertaDivergencia:
        compare.status === "DIVERGENTE"
          ? "Alerta de divergência fiscal: o cadastro atual não segue a regra da Egaplast deste NCM. A mesma regra vale para todos os produtos desse NCM. Se o NCM estiver errado, corrija o NCM primeiro."
          : compare.status === "NECESSITA_ANALISE"
            ? compare.motivo
            : null,
      matriz: [],
    };
  }

  const destaqueStInterno =
    rule.situacaoCodigo === "ST_INTERNO"
      ? "Na entrada a NF do fornecedor deve vir CST 0. Na saída, CST 0 vai para Não contribuinte, Construtora, Hosp/clínica, Órgão público e Produtor rural; CST 10 vai para Contribuinte, Revenda e Atacado."
      : null;

  return {
    ncm: rule.ncm,
    situacao: rule.situacao || rule.situacaoCodigo,
    cstEntrada: rule.cstEntrada ?? "não informado na base (não inventado)",
    cstSaida: rule.cstSaida ?? "não informado na base",
    cfopSaida: rule.cfopSaida ?? "não informado na base",
    mva: rule.mvaTexto ?? (rule.mvaPercentual != null ? `${rule.mvaPercentual}%` : "não se aplica / vazio"),
    cfopEntradaNota: `conforme operação (dentro/fora do estado) — CFOP de entrada não está na ${baseLabel}`,
    destaqueStInterno,
    checklist: [
      "Conferir NCM na NF do fornecedor",
      "Conferir CST da nota de entrada",
      "Conferir ICMS destacado",
      "Conferir ST / MVA quando a situação exigir",
      `Conferir CEST somente se constar no cadastro ou na NF (a ${baseLabel} não traz CEST)`,
    ],
    alertaDivergencia:
      compare.status === "DIVERGENTE"
        ? `Alerta de divergência fiscal: o cadastro atual não segue a regra da ${sheetLabel} deste NCM. A mesma regra vale para todos os produtos desse NCM. Se o NCM estiver errado, corrija o NCM primeiro.`
        : compare.status === "NECESSITA_ANALISE"
          ? compare.motivo
          : null,
    matriz: DESTINO_KEYS.map((key) => ({
      destino: DESTINO_LABELS[key],
      cst: rule.destinosCst[key] ?? "—",
    })),
  };
}

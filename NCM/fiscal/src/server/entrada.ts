import "server-only";

import type { CompareResult, FiscalRule } from "./compare";
import { DESTINO_KEYS, DESTINO_LABELS } from "@/src/lib/fiscal";

export type EntradaGuide = {
  ncm: string;
  situacao: string;
  cstEntrada: string;
  cstBaifer: string;
  cfopSaida: string;
  mva: string;
  cfopEntradaNota: string;
  destaqueStInterno: string | null;
  checklist: string[];
  alertaDivergencia: string | null;
  matriz: { destino: string; cst: string }[];
};

export function buildEntradaGuide(
  rule: FiscalRule | null,
  compare: CompareResult,
  ncmAtual?: string,
): EntradaGuide | null {
  if (!rule) {
    return {
      ncm: ncmAtual || "—",
      situacao: "NCM do cadastro inválido ou ausente",
      cstEntrada: "indisponível até o NCM estar na aba BAIFER",
      cstBaifer: "indisponível até o NCM estar na aba BAIFER",
      cfopSaida: "indisponível até o NCM estar na aba BAIFER",
      mva: "indisponível até o NCM estar na aba BAIFER",
      cfopEntradaNota: "corrija o NCM na Base fiscal antes de orientar a entrada",
      destaqueStInterno: null,
      checklist: [
        "Abrir a Base fiscal e localizar o NCM correto do produto",
        "A regra da aba BAIFER daquele NCM vale para todos os produtos com esse NCM",
        "Corrigir o NCM no cadastro do cliente",
        "Só então conferir CST, ICMS, ST/MVA e CEST na NF de entrada",
      ],
      alertaDivergencia:
        compare.motivo ||
        "NCM do cliente está vazio ou não está na planilha BAIFER. Sem o NCM certo, o cadastro fiscal inteiro fica errado.",
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
    cstBaifer: rule.cstSaida ?? "não informado na base",
    cfopSaida: rule.cfopSaida ?? "não informado na base",
    mva: rule.mvaTexto ?? (rule.mvaPercentual != null ? `${rule.mvaPercentual}%` : "não se aplica / vazio"),
    cfopEntradaNota: "conforme operação (dentro/fora do estado) — CFOP de entrada não está na base BAIFER",
    destaqueStInterno,
    checklist: [
      "Conferir NCM na NF do fornecedor",
      "Conferir CST da nota de entrada",
      "Conferir ICMS destacado",
      "Conferir ST / MVA quando a situação exigir",
      "Conferir CEST somente se constar no cadastro ou na NF (a base BAIFER não traz CEST)",
    ],
    alertaDivergencia:
      compare.status === "DIVERGENTE"
        ? "Alerta de divergência fiscal: o cadastro atual não segue a regra da aba BAIFER deste NCM. A mesma regra vale para todos os produtos desse NCM. Se o NCM estiver errado, corrija o NCM primeiro."
        : compare.status === "NECESSITA_ANALISE"
          ? compare.motivo
          : null,
    matriz: DESTINO_KEYS.map((key) => ({
      destino: DESTINO_LABELS[key],
      cst: rule.destinosCst[key] ?? "—",
    })),
  };
}

import { mvaRequiresAnalysis, normalizeCst } from "./ncm";
import {
  DESTINO_KEYS,
  DESTINO_LABELS,
  type DestinoKey,
  type DestinosCst,
  type FieldDiff,
  type StatusFiscal,
} from "@/src/lib/fiscal";

export type { DestinoKey, DestinosCst, FieldDiff, StatusFiscal };
export { DESTINO_KEYS, DESTINO_LABELS };

export type FiscalRule = {
  id: string;
  ncm: string;
  ncmOriginal: string;
  segmento: string;
  cstEntrada: string | null;
  cstSaida: string | null;
  cfopSaida: string | null;
  destinosCst: DestinosCst;
  situacao: string;
  situacaoCodigo: string;
  mvaPercentual: number | null;
  mvaTexto: string | null;
  mvaKind: string;
};

export type ImportedProduct = {
  id?: string;
  codigo: string;
  descricao: string;
  ncm: string;
  ncmOriginal: string;
  aliquotaIcms?: string | null;
  ivaMva?: string | null;
  ivaMvaNumero?: number | null;
  cest?: string | null;
  cstCompra?: string | null;
  cstUnico?: string | null;
  destinosCst?: DestinosCst | null;
};

export type CompareResult = {
  status: StatusFiscal;
  motivo: string;
  diffs: FieldDiff[];
  rule: FiscalRule | null;
  candidates: FiscalRule[];
  needsLink: boolean;
};

function emptyDestinos(): DestinosCst {
  return {
    naoContribuinte: null,
    contribuinte: null,
    revenda: null,
    construtora: null,
    hospClinica: null,
    orgaoPublico: null,
    produtorRural: null,
    atacado: null,
  };
}

export function asDestinos(raw: unknown): DestinosCst {
  const base = emptyDestinos();
  if (!raw || typeof raw !== "object") return base;
  const record = raw as Record<string, unknown>;
  for (const key of DESTINO_KEYS) {
    const value = record[key];
    base[key] = value == null || value === "" ? null : String(value);
  }
  return base;
}

function destinosPreenchidos(destinos: DestinosCst | null | undefined): number {
  if (!destinos) return 0;
  return DESTINO_KEYS.filter((key) => Boolean(destinos[key])).length;
}

export function compareProduct(
  product: ImportedProduct,
  rulesForNcm: FiscalRule[],
  linkedRuleId: string | null,
): CompareResult {
  if (!product.ncm) {
    return {
      status: "DIVERGENTE",
      motivo:
        "NCM vazio no cadastro do cliente. Sem NCM correto, CST, MVA e entrada ficam todos errados. A regra da empresa vale para todo produto daquele NCM — corrija o NCM na Base fiscal e recadastre.",
      diffs: [
        {
          campo: "NCM",
          atual: product.ncmOriginal || "(vazio)",
          ideal: "Informar o NCM que existe na base fiscal da empresa",
        },
      ],
      rule: null,
      candidates: [],
      needsLink: false,
    };
  }

  if (rulesForNcm.length === 0) {
    return {
      status: "DIVERGENTE",
      motivo:
        "NCM do cadastro não existe na base fiscal desta empresa. Se o NCM está errado, o cliente cadastra CST e MVA em cima do código errado. A regra vale para todos os produtos daquele NCM — busque o NCM certo na Base fiscal e aplique essa matriz.",
      diffs: [
        {
          campo: "NCM",
          atual: product.ncmOriginal || product.ncm,
          ideal: "NCM da base fiscal (este código não está na regra da empresa)",
        },
      ],
      rule: null,
      candidates: [],
      needsLink: false,
    };
  }

  if (rulesForNcm.length > 1 && !linkedRuleId) {
    return {
      status: "NECESSITA_ANALISE",
      motivo: "NCM com duas regras (ST e REDUÇÃO). Vincule a hipótese correta.",
      diffs: [],
      rule: null,
      candidates: rulesForNcm,
      needsLink: true,
    };
  }

  const rule =
    rulesForNcm.find((item) => item.id === linkedRuleId) ??
    (rulesForNcm.length === 1 ? rulesForNcm[0] : null);

  if (!rule) {
    return {
      status: "NECESSITA_ANALISE",
      motivo: "Vínculo de regra inválido para este NCM.",
      diffs: [],
      rule: null,
      candidates: rulesForNcm,
      needsLink: true,
    };
  }

  if (!rule.cstSaida || !rule.cfopSaida || rule.situacaoCodigo === "INCOMPLETA") {
    return {
      status: "NECESSITA_ANALISE",
      motivo: "Regra incompleta na base (CST/CFOP vazios).",
      diffs: [],
      rule,
      candidates: rulesForNcm,
      needsLink: false,
    };
  }

  if (rule.mvaKind === "analise" || mvaRequiresAnalysis(rule.mvaTexto) || mvaRequiresAnalysis(product.ivaMva)) {
    return {
      status: "NECESSITA_ANALISE",
      motivo: "MVA da base ou do cadastro exige análise (#N/D ou texto não numérico).",
      diffs: [],
      rule,
      candidates: rulesForNcm,
      needsLink: false,
    };
  }

  const hasMatrix = destinosPreenchidos(product.destinosCst) >= 2;
  if (!hasMatrix && rule.situacaoCodigo === "ST_INTERNO") {
    return {
      status: "NECESSITA_ANALISE",
      motivo: "ST INTERNO exige a matriz dos 8 destinatários. O cadastro veio com CST único.",
      diffs: compareFields(product, rule),
      rule,
      candidates: rulesForNcm,
      needsLink: false,
    };
  }

  const diffs = compareFields(product, rule);
  if (diffs.length > 0) {
    return {
      status: "DIVERGENTE",
      motivo:
        "Cadastro diverge da regra fiscal desta empresa para este NCM. Essa regra vale para todos os produtos do NCM. Se o NCM do cliente estiver errado, CST e MVA também estarão errados — confirme o NCM na Base fiscal antes de corrigir o ERP.",
      diffs,
      rule,
      candidates: rulesForNcm,
      needsLink: false,
    };
  }

  return {
    status: "CORRETO",
    motivo:
      "A matriz bate com a regra desta empresa para este NCM (vale para todos os produtos desse NCM). Confirme se o NCM do produto realmente é este; NCM errado no ERP mascara o restante.",
    diffs: [],
    rule,
    candidates: rulesForNcm,
    needsLink: false,
  };
}

function compareFields(product: ImportedProduct, rule: FiscalRule): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const hasAnyDestino = destinosPreenchidos(product.destinosCst) > 0;

  if (hasAnyDestino && product.destinosCst) {
    for (const key of DESTINO_KEYS) {
      const ideal = normalizeCst(rule.destinosCst[key]);
      if (ideal == null) continue;
      const atual = normalizeCst(product.destinosCst[key]);
      if (atual !== ideal) {
        diffs.push({
          campo: DESTINO_LABELS[key],
          atual: atual ?? "(vazio)",
          ideal,
        });
      }
    }
  } else if (product.cstUnico) {
    const atual = normalizeCst(product.cstUnico);
    const ideal = normalizeCst(rule.cstSaida);
    if (ideal != null && atual !== ideal) {
      diffs.push({
        campo: "CST BAIFER",
        atual: atual ?? "(vazio)",
        ideal,
      });
    }
  }

  const idealEntrada = normalizeCst(rule.cstEntrada);
  if (idealEntrada != null && product.cstCompra) {
    const atual = normalizeCst(product.cstCompra);
    if (atual !== idealEntrada) {
      diffs.push({
        campo: "CST compra / nota de entrada",
        atual: atual ?? "(vazio)",
        ideal: idealEntrada,
      });
    }
  }

  if (rule.mvaPercentual != null && product.ivaMvaNumero != null) {
    if (Math.abs(rule.mvaPercentual - product.ivaMvaNumero) > 0.05) {
      diffs.push({
        campo: "MVA / IVA",
        atual: String(product.ivaMvaNumero),
        ideal: String(rule.mvaPercentual),
      });
    }
  }

  return diffs;
}

export function summarizeStatus(results: CompareResult[]): {
  total: number;
  corretos: number;
  divergentes: number;
  analise: number;
} {
  const total = results.length;
  return {
    total,
    corretos: results.filter((r) => r.status === "CORRETO").length,
    divergentes: results.filter((r) => r.status === "DIVERGENTE").length,
    analise: results.filter((r) => r.status === "NECESSITA_ANALISE").length,
  };
}

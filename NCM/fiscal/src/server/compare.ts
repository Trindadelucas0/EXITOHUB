import { mvaRequiresAnalysis, normalizeCst } from "./ncm";
import { isEgaplastCompany } from "./company-slug";
import {
  DESTINO_KEYS,
  DESTINO_LABELS,
  type DestinoKey,
  type DestinosCst,
  type FieldDiff,
  type StatusFiscal,
  type UfTributacao,
} from "@/src/lib/fiscal";
import { hasFilledIvaPorUf, ivaPorUfDiffs, type IvaPorUf } from "@/src/lib/iva-por-uf";
import { ivaIdealForOrigem } from "@/src/lib/origem-iva";

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
  cest?: string | null;
  ipi?: string | null;
  abreviacao?: string | null;
  reducao?: boolean;
  reducaoPercentual?: number | null;
  ufTributacao?: UfTributacao | null;
  ivaPorUf?: IvaPorUf | null;
  ivaPorUfImportado?: IvaPorUf | null;
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
  abreviacao?: string | null;
  cstCompra?: string | null;
  cstUnico?: string | null;
  destinosCst?: DestinosCst | null;
  origem?: string | null;
  ivaPorUf?: IvaPorUf | null;
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

/** Matriz padrão ST interno: 0 vs 10 nos destinatários. */
const ST_INTERNO_DESTINOS: DestinosCst = {
  naoContribuinte: "0",
  contribuinte: "10",
  revenda: "10",
  construtora: "0",
  hospClinica: "0",
  orgaoPublico: "0",
  produtorRural: "0",
  atacado: "10",
};

/**
 * Completa só destinos vazios da regra (não sobrescreve o que a base já tem).
 * ST interno usa a matriz 0/10; demais situações usam cstSaida.
 */
export function completeRuleDestinos(rule: FiscalRule): FiscalRule {
  const destinos = emptyDestinos();
  for (const key of DESTINO_KEYS) {
    const existing = rule.destinosCst[key];
    if (existing != null && existing !== "") {
      destinos[key] = existing;
      continue;
    }
    if (rule.situacaoCodigo === "ST_INTERNO") {
      destinos[key] = ST_INTERNO_DESTINOS[key];
      continue;
    }
    destinos[key] = rule.cstSaida || null;
  }
  return { ...rule, destinosCst: destinos };
}

export type CompareOptions = {
  companySlug?: string | null;
};

export function compareProduct(
  product: ImportedProduct,
  rulesForNcm: FiscalRule[],
  linkedRuleId: string | null,
  options: CompareOptions = {},
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
    const ncmAtual = product.ncm || product.ncmOriginal;
    if (isEgaplastCompany(options.companySlug)) {
      return {
        status: "DIVERGENTE",
        motivo: `O errado é o NCM. Como está: ${ncmAtual}. Como deve ficar: um NCM da Base fiscal.`,
        diffs: [
          {
            campo: "NCM",
            atual: ncmAtual,
            ideal: "um NCM da Base fiscal",
          },
        ],
        rule: null,
        candidates: [],
        needsLink: false,
      };
    }
    return {
      status: "DIVERGENTE",
      motivo:
        "NCM do cadastro não existe na base fiscal desta empresa. Se o NCM está errado, o cliente cadastra CST e MVA em cima do código errado. A regra vale para todos os produtos daquele NCM — busque o NCM certo na Base fiscal e aplique essa matriz.",
      diffs: [
        {
          campo: "NCM",
          atual: ncmAtual,
          ideal: "NCM da base fiscal (este código não está na regra da empresa)",
        },
      ],
      rule: null,
      candidates: [],
      needsLink: false,
    };
  }

  if (isEgaplastCompany(options.companySlug)) {
    return compareEgaplastProduct(product, rulesForNcm, linkedRuleId);
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

  const rawRule =
    rulesForNcm.find((item) => item.id === linkedRuleId) ??
    (rulesForNcm.length === 1 ? rulesForNcm[0] : null);

  if (!rawRule) {
    return {
      status: "NECESSITA_ANALISE",
      motivo: "Vínculo de regra inválido para este NCM.",
      diffs: [],
      rule: null,
      candidates: rulesForNcm,
      needsLink: true,
    };
  }

  const rule = completeRuleDestinos(rawRule);

  if (isUnicaRule(rawRule)) {
    return compareUnicaProduct(product, rawRule, rulesForNcm);
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

function pickEgaplastRule(
  product: ImportedProduct,
  rulesForNcm: FiscalRule[],
  linkedRuleId: string | null,
): { rule: FiscalRule | null; needsLink: boolean } {
  if (linkedRuleId) {
    const linked = rulesForNcm.find((item) => item.id === linkedRuleId) ?? null;
    return { rule: linked, needsLink: !linked };
  }
  const complete = rulesForNcm.filter((item) => item.situacaoCodigo !== "INCOMPLETA");
  if (complete.length === 1) return { rule: complete[0] ?? null, needsLink: false };
  const cst = normalizeCst(product.cstUnico);
  if (cst != null) {
    const matches = complete.filter((item) => normalizeCst(item.cstSaida) === cst);
    if (matches.length === 1) return { rule: matches[0] ?? null, needsLink: false };
  }
  if (complete.length === 0 && rulesForNcm.length === 1) {
    return { rule: rulesForNcm[0] ?? null, needsLink: false };
  }
  return { rule: null, needsLink: complete.length > 1 || rulesForNcm.length > 1 };
}

function compareEgaplastTributacaoProduct(
  product: ImportedProduct,
  rulesForNcm: FiscalRule[],
  linkedRuleId: string | null,
): CompareResult {
  const ufRules = rulesForNcm.filter(isUnicaRule);
  const picked =
    (linkedRuleId ? ufRules.find((item) => item.id === linkedRuleId) : null) ??
    (ufRules.length === 1 ? ufRules[0] : null);
  if (!picked) {
    return {
      status: "NECESSITA_ANALISE",
      motivo:
        ufRules.length > 1
          ? "NCM com mais de uma regra na tributação Egaplast. Vincule a hipótese correta."
          : "Vínculo de regra inválido para este NCM.",
      diffs: [],
      rule: null,
      candidates: rulesForNcm,
      needsLink: ufRules.length > 1,
    };
  }
  const diffs: FieldDiff[] = [];
  if (product.cest && picked.cest) {
    const atual = foldCest(product.cest);
    const ideal = foldCest(picked.cest);
    if (atual && ideal && atual !== ideal) {
      diffs.push({ campo: "CEST", atual: product.cest, ideal: picked.cest });
    }
  }
  if (diffs.length > 0) {
    return {
      status: "DIVERGENTE",
      motivo: `Cadastro Egaplast diverge da tributação deste NCM (${diffs.map((d) => d.campo).join(", ")}).`,
      diffs,
      rule: picked,
      candidates: rulesForNcm,
      needsLink: false,
    };
  }
  return {
    status: "CORRETO",
    motivo: "NCM do cadastro Egaplast consta na planilha de tributação desta empresa.",
    diffs: [],
    rule: picked,
    candidates: rulesForNcm,
    needsLink: false,
  };
}

function isCstIvaEgaplastRule(rule: FiscalRule): boolean {
  if (isUnicaRule(rule)) return hasFilledIvaPorUf(rule.ivaPorUf);
  return true;
}

function compareEgaplastProduct(
  product: ImportedProduct,
  rulesForNcm: FiscalRule[],
  linkedRuleId: string | null,
): CompareResult {
  const cstIvaRules = rulesForNcm.filter(isCstIvaEgaplastRule);
  const hasCompleteCstIva = cstIvaRules.some((item) => item.situacaoCodigo !== "INCOMPLETA");
  const productHasCstIva =
    Boolean(product.cstUnico) || hasFilledIvaPorUf(product.ivaPorUf) || product.ivaMvaNumero != null;
  if (hasCompleteCstIva && productHasCstIva) {
    return compareEgaplastCstIvaProduct(product, cstIvaRules, linkedRuleId);
  }
  if (rulesForNcm.some(isUnicaRule)) {
    return compareEgaplastTributacaoProduct(product, rulesForNcm, linkedRuleId);
  }
  return compareEgaplastCstIvaProduct(product, rulesForNcm, linkedRuleId);
}

function compareEgaplastCstIvaProduct(
  product: ImportedProduct,
  rulesForNcm: FiscalRule[],
  linkedRuleId: string | null,
): CompareResult {
  const picked = pickEgaplastRule(product, rulesForNcm, linkedRuleId);
  if (!picked.rule) {
    return {
      status: "NECESSITA_ANALISE",
      motivo: picked.needsLink
        ? "NCM com duas regras na Egaplast (CST 00 e 10). Vincule a hipótese ou importe o cadastro com SIT.TRIBUTÁRIA."
        : "Vínculo de regra inválido para este NCM.",
      diffs: [],
      rule: null,
      candidates: rulesForNcm,
      needsLink: picked.needsLink,
    };
  }
  const rule = picked.rule;
  if (rule.situacaoCodigo === "INCOMPLETA" || !rule.cstSaida) {
    return {
      status: "NECESSITA_ANALISE",
      motivo: "Este NCM está na base Egaplast sem SIT.TRIBUTÁRIA/IVA (só na listagem). Não inventar CST.",
      diffs: [],
      rule,
      candidates: rulesForNcm,
      needsLink: false,
    };
  }
  if (!product.cstUnico) {
    return {
      status: "NECESSITA_ANALISE",
      motivo: "Cadastro sem SIT.TRIBUTÁRIA. Importe a aba de tributação (Planilha1) ou o relatório de produtos.",
      diffs: [],
      rule,
      candidates: rulesForNcm,
      needsLink: false,
    };
  }
  const diffs: FieldDiff[] = [];
  const atualCst = normalizeCst(product.cstUnico);
  const idealCst = normalizeCst(rule.cstSaida);
  if (idealCst != null && atualCst !== idealCst) {
    diffs.push({
      campo: "CST saída",
      atual: atualCst ?? "(vazio)",
      ideal: idealCst,
    });
  }
  if (hasFilledIvaPorUf(product.ivaPorUf)) {
    const idealIva = ivaIdealForOrigem(rule, product.origem);
    if (hasFilledIvaPorUf(idealIva)) {
      for (const diff of ivaPorUfDiffs(product.ivaPorUf, idealIva)) {
        diffs.push({
          campo: `IVA ${diff.uf}`,
          atual: diff.atual,
          ideal: diff.ideal,
        });
      }
    }
  } else if (rule.mvaPercentual != null && product.ivaMvaNumero != null && !isUnicaRule(rule)) {
    if (Math.abs(rule.mvaPercentual - product.ivaMvaNumero) > 0.05) {
      diffs.push({
        campo: "MVA / IVA",
        atual: String(product.ivaMvaNumero),
        ideal: String(rule.mvaPercentual),
      });
    }
  }
  if (diffs.length > 0) {
    return {
      status: "DIVERGENTE",
      motivo: `Cadastro Egaplast diverge da regra deste NCM (${diffs.map((d) => d.campo).join(", ")}).`,
      diffs,
      rule,
      candidates: rulesForNcm,
      needsLink: false,
    };
  }
  return {
    status: "CORRETO",
    motivo: "CST e IVA do cadastro Egaplast conferem com a regra deste NCM.",
    diffs: [],
    rule,
    candidates: rulesForNcm,
    needsLink: false,
  };
}

function isUnicaRule(rule: FiscalRule): boolean {
  return rule.situacaoCodigo === "TRIBUTACAO_UF" || Boolean(rule.ufTributacao);
}

function foldCest(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits || null;
}

/** Trim; se só dígitos, remove zeros à esquerda (004→4; mantém 0). */
export function foldAbrev(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    const stripped = text.replace(/^0+/, "");
    return stripped || "0";
  }
  return text;
}

function compareUnicaProduct(
  product: ImportedProduct,
  rule: FiscalRule,
  candidates: FiscalRule[],
): CompareResult {
  const hasCadastro =
    Boolean(product.cest) ||
    Boolean(product.aliquotaIcms) ||
    product.ivaMvaNumero != null ||
    Boolean(product.abreviacao);
  if (!hasCadastro) {
    return {
      status: "NECESSITA_ANALISE",
      motivo:
        "Base Unica não compara matriz CST. Importe o CSV de produtos (Cód.Item / Desc. Abrev. ICMS / Abreviação fiscal) para conferir CEST, alíquota, MVA e Abreviação.",
      diffs: [],
      rule,
      candidates,
      needsLink: false,
    };
  }

  const diffs: FieldDiff[] = [];
  if (product.cest && rule.cest) {
    const atual = foldCest(product.cest);
    const ideal = foldCest(rule.cest);
    if (atual && ideal && atual !== ideal) {
      diffs.push({ campo: "CEST", atual: product.cest, ideal: rule.cest });
    }
  }
  // Desc. Abrev. ICMS (ex. "000 18 0") é CST/alíquota do ERP, não a alíquota interna DF da base.
  // Comparar os dois marcava o lote inteiro como DIVERGENTE.
  if (rule.mvaPercentual != null && product.ivaMvaNumero != null) {
    if (Math.abs(rule.mvaPercentual - product.ivaMvaNumero) > 0.05) {
      diffs.push({
        campo: "MVA / IVA",
        atual: String(product.ivaMvaNumero),
        ideal: String(rule.mvaPercentual),
      });
    }
  }
  const abrevAtual = foldAbrev(product.abreviacao);
  const abrevIdeal = foldAbrev(rule.abreviacao);
  if (abrevAtual != null && abrevIdeal != null && abrevAtual !== abrevIdeal) {
    diffs.push({
      campo: "Abreviação",
      atual: String(product.abreviacao).trim(),
      ideal: String(rule.abreviacao).trim(),
    });
  }

  if (diffs.length > 0) {
    const campos = diffs.map((d) => d.campo).join(", ");
    return {
      status: "DIVERGENTE",
      motivo: `Cadastro Unica diverge da base fiscal deste NCM (${campos}).`,
      diffs,
      rule,
      candidates,
      needsLink: false,
    };
  }

  return {
    status: "CORRETO",
    motivo: "NCM da Unica confere CEST/alíquota/MVA/Abreviação com a base fiscal desta empresa.",
    diffs: [],
    rule,
    candidates,
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

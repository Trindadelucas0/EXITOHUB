import "server-only";

import {
  DESTINO_KEYS,
  cstCellsDiverge,
  displayCst,
  type DestinosCst,
  type FieldDiff,
  type StatusFiscal,
} from "@/src/lib/fiscal";
import type { CompareResult, FiscalRule } from "./compare";
import { summarizeStatus } from "./compare";

export type ExportProduct = {
  codigo: string;
  descricao: string;
  ncm: string;
  status: StatusFiscal;
  motivo: string;
  situacao: string;
  cstEntradaAtual: string | null;
  cstEntradaIdeal: string | null;
  cstSaidaAtual: string | null;
  cstSaidaIdeal: string | null;
  cfopSaida: string | null;
  mvaAtual: string | null;
  mvaIdeal: string | null;
  destinosAtual: DestinosCst | null;
  destinosIdeal: DestinosCst | null;
  diffs: FieldDiff[];
};

export type ExportRuleSnap = {
  ncm: string;
  segmento: string;
  cstEntrada: string | null;
  cstSaida: string | null;
  cfopSaida: string | null;
  destinosCst: DestinosCst;
  situacao: string;
  situacaoCodigo: string;
  mvaTexto: string | null;
};

export type ExportGroup = {
  key: string;
  ncm: string;
  rule: ExportRuleSnap | null;
  products: ExportProduct[];
};

export type ExportMeta = {
  companyName: string;
  batchFileName: string;
  generatedAt: Date;
  title: string;
  total: number;
  divergentes: number;
  analise: number;
};

export type ExportReport = {
  meta: ExportMeta;
  groups: ExportGroup[];
};

export type ExportItemInput = {
  codigo: string;
  descricao: string;
  ncm: string;
  cstCompra?: string | null;
  cstUnico?: string | null;
  ivaMva?: string | null;
  destinosCst?: DestinosCst | null;
  compare: CompareResult;
};

export const EXPORT_COLORS = {
  brand: "2EA44F",
  paper: "F1F5F2",
  raised: "FFFFFF",
  ink: "1A1F24",
  muted: "5C6570",
  line: "C3CEC7",
  white: "FFFFFF",
  bad: "9B2C2C",
  badBg: "F8E8E8",
  ok: "1F7A45",
  okBg: "E4F5EA",
  warn: "1A1F24",
  warnBg: "FFF6D6",
} as const;

export function ruleMva(rule: FiscalRule | null | undefined): string | null {
  if (!rule) return null;
  if (rule.mvaPercentual != null) return String(rule.mvaPercentual);
  return rule.mvaTexto;
}

export function snapRule(rule: FiscalRule): ExportRuleSnap {
  return {
    ncm: rule.ncm,
    segmento: rule.segmento,
    cstEntrada: rule.cstEntrada,
    cstSaida: rule.cstSaida,
    cfopSaida: rule.cfopSaida,
    destinosCst: rule.destinosCst,
    situacao: rule.situacao,
    situacaoCodigo: rule.situacaoCodigo,
    mvaTexto: ruleMva(rule),
  };
}

export function formatExportDate(date: Date): string {
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function cellMismatch(
  atual: string | null | undefined,
  ideal: string | null | undefined,
): boolean {
  return cstCellsDiverge(atual, ideal);
}

export function showCst(value: string | null | undefined): string {
  return displayCst(value);
}

export function buildReport(input: {
  companyName: string;
  batchFileName: string;
  generatedAt?: Date;
  title?: string;
  items: ExportItemInput[];
}): ExportReport {
  const generatedAt = input.generatedAt ?? new Date();
  const totals = summarizeStatus(input.items.map((item) => item.compare));
  const sorted = [...input.items].sort((a, b) => {
    const ncm = a.ncm.localeCompare(b.ncm, "pt-BR");
    if (ncm !== 0) return ncm;
    return a.codigo.localeCompare(b.codigo, "pt-BR");
  });

  const groups: ExportGroup[] = [];
  const index = new Map<string, ExportGroup>();

  for (const item of sorted) {
    const rule = item.compare.rule;
    const ncm = item.ncm || "(vazio)";
    const key = `${ncm}::${rule?.id ?? "sem-regra"}`;
    let group = index.get(key);
    if (!group) {
      group = {
        key,
        ncm,
        rule: rule ? snapRule(rule) : null,
        products: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    group.products.push({
      codigo: item.codigo,
      descricao: item.descricao,
      ncm: item.ncm,
      status: item.compare.status,
      motivo: item.compare.motivo,
      situacao: rule?.situacaoCodigo || rule?.situacao || "",
      cstEntradaAtual: item.cstCompra ?? null,
      cstEntradaIdeal: rule?.cstEntrada ?? null,
      cstSaidaAtual: item.cstUnico ?? null,
      cstSaidaIdeal: rule?.cstSaida ?? null,
      cfopSaida: rule?.cfopSaida ?? null,
      mvaAtual: item.ivaMva ?? null,
      mvaIdeal: ruleMva(rule),
      destinosAtual: item.destinosCst ?? null,
      destinosIdeal: rule?.destinosCst ?? null,
      diffs: item.compare.diffs,
    });
  }

  return {
    meta: {
      companyName: input.companyName,
      batchFileName: input.batchFileName,
      generatedAt,
      title: input.title ?? "Relatório de divergências",
      total: totals.total,
      divergentes: totals.divergentes,
      analise: totals.analise,
    },
    groups,
  };
}

export function buildReportFromCompared(input: {
  companyName: string;
  batchFileName: string;
  generatedAt?: Date;
  title?: string;
  items: {
    product: {
      codigo: string;
      descricao: string;
      ncm: string;
      cstCompra?: string | null;
      cstUnico?: string | null;
      ivaMva?: string | null;
      destinosCst?: DestinosCst | null;
    };
    compare: CompareResult;
  }[];
}): ExportReport {
  return buildReport({
    companyName: input.companyName,
    batchFileName: input.batchFileName,
    generatedAt: input.generatedAt,
    title: input.title,
    items: input.items.map((item) => ({
      codigo: item.product.codigo,
      descricao: item.product.descricao,
      ncm: item.product.ncm,
      cstCompra: item.product.cstCompra,
      cstUnico: item.product.cstUnico,
      ivaMva: item.product.ivaMva,
      destinosCst: item.product.destinosCst,
      compare: item.compare,
    })),
  });
}

export function allProducts(report: ExportReport): ExportProduct[] {
  return report.groups.flatMap((group) => group.products);
}

export function rulesOfReport(report: ExportReport): ExportRuleSnap[] {
  const seen = new Set<string>();
  const rules: ExportRuleSnap[] = [];
  for (const group of report.groups) {
    if (!group.rule) continue;
    const id = `${group.rule.ncm}:${group.rule.situacaoCodigo}:${group.rule.segmento}`;
    if (seen.has(id)) continue;
    seen.add(id);
    rules.push(group.rule);
  }
  return rules;
}

export function ruleBannerText(rule: ExportRuleSnap | null, ncm: string): string {
  if (!rule) {
    return `NCM ${ncm} — Sem regra na base fiscal`;
  }
  const destinos = DESTINO_KEYS.map((key) => `${showCst(rule.destinosCst[key])}`).join("  ");
  return [
    `NCM ${rule.ncm}`,
    rule.segmento,
    rule.situacaoCodigo || rule.situacao,
    `CST entrada ${showCst(rule.cstEntrada)}`,
    `CST BAIFER ${showCst(rule.cstSaida)}`,
    `CFOP ${showCst(rule.cfopSaida)}`,
    `MVA ${showCst(rule.mvaTexto)}`,
    destinos,
  ].join("  ·  ");
}

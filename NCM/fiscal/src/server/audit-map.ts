import { Prisma } from "@prisma/client";
import { asDestinos, type FiscalRule, type ImportedProduct } from "./compare";
import { asUfTributacao } from "@/src/lib/fiscal";

function toNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

export function ruleFromDb(row: {
  id: string;
  ncm: string;
  ncmOriginal: string;
  segmento: string;
  cstEntrada: string | null;
  cstSaida: string | null;
  cfopSaida: string | null;
  destinosCst: Prisma.JsonValue;
  situacao: string;
  situacaoCodigo: string;
  mvaPercentual: Prisma.Decimal | number | null;
  mvaTexto: string | null;
  mvaKind: string;
  cest?: string | null;
  ipi?: string | null;
  abreviacao?: string | null;
  reducao?: boolean;
  reducaoPercentual?: Prisma.Decimal | number | null;
  ufTributacao?: Prisma.JsonValue | null;
}): FiscalRule {
  return {
    id: row.id,
    ncm: row.ncm,
    ncmOriginal: row.ncmOriginal,
    segmento: row.segmento,
    cstEntrada: row.cstEntrada,
    cstSaida: row.cstSaida,
    cfopSaida: row.cfopSaida,
    destinosCst: asDestinos(row.destinosCst),
    situacao: row.situacao,
    situacaoCodigo: row.situacaoCodigo,
    mvaPercentual: toNumber(row.mvaPercentual),
    mvaTexto: row.mvaTexto,
    mvaKind: row.mvaKind,
    cest: row.cest ?? null,
    ipi: row.ipi ?? null,
    abreviacao: row.abreviacao ?? null,
    reducao: Boolean(row.reducao),
    reducaoPercentual: toNumber(row.reducaoPercentual),
    ufTributacao: asUfTributacao(row.ufTributacao ?? null),
  };
}

export function productFromDb(row: {
  id: string;
  codigo: string;
  descricao: string;
  ncm: string;
  ncmOriginal: string;
  aliquotaIcms: string | null;
  ivaMva: string | null;
  ivaMvaNumero: Prisma.Decimal | number | null;
  cest: string | null;
  abreviacao?: string | null;
  cstCompra: string | null;
  cstUnico: string | null;
  destinosCst: Prisma.JsonValue | null;
}): ImportedProduct {
  return {
    id: row.id,
    codigo: row.codigo,
    descricao: row.descricao,
    ncm: row.ncm,
    ncmOriginal: row.ncmOriginal,
    aliquotaIcms: row.aliquotaIcms,
    ivaMva: row.ivaMva,
    ivaMvaNumero: toNumber(row.ivaMvaNumero),
    cest: row.cest,
    abreviacao: row.abreviacao ?? null,
    cstCompra: row.cstCompra,
    cstUnico: row.cstUnico,
    destinosCst: row.destinosCst ? asDestinos(row.destinosCst) : null,
  };
}

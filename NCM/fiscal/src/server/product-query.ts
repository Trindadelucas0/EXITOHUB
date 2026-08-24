import type { StatusFiscal } from "@/src/lib/fiscal";

export const PRODUCT_PAGE_SIZE_DEFAULT = 25;
export const PRODUCT_PAGE_SIZE_MAX = 100;

export type TreatedFilter = "" | "nao" | "sim";

export type ProductListParams = {
  q: string;
  ncm: string;
  status: StatusFiscal | "";
  tratado: TreatedFilter;
  page: number;
  pageSize: number;
};

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function parseProductListParams(url: URL): ProductListParams {
  const q = (url.searchParams.get("q") ?? "").trim();
  const ncm = digitsOnly(url.searchParams.get("ncm") ?? "");
  const rawStatus = (url.searchParams.get("status") ?? "").trim();
  const status: ProductListParams["status"] =
    rawStatus === "DIVERGENTE" || rawStatus === "NECESSITA_ANALISE" || rawStatus === "CORRETO"
      ? rawStatus
      : "";
  const rawTratado = (url.searchParams.get("tratado") ?? "").trim();
  const tratado: TreatedFilter = rawTratado === "nao" || rawTratado === "sim" ? rawTratado : "";
  const pageRaw = Number(url.searchParams.get("page") ?? 1);
  const sizeRaw = Number(url.searchParams.get("pageSize") ?? PRODUCT_PAGE_SIZE_DEFAULT);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(sizeRaw)
    ? Math.min(PRODUCT_PAGE_SIZE_MAX, Math.max(1, Math.floor(sizeRaw)))
    : PRODUCT_PAGE_SIZE_DEFAULT;
  return { q, ncm, status, tratado, page, pageSize };
}

const SOMENTE_TO_STATUS: Record<string, StatusFiscal> = {
  divergentes: "DIVERGENTE",
  corretos: "CORRETO",
  analise: "NECESSITA_ANALISE",
};

const STATUS_TO_EXPORT_SLUG: Record<StatusFiscal, string> = {
  DIVERGENTE: "divergentes",
  CORRETO: "corretos",
  NECESSITA_ANALISE: "analise",
};

export type ExportStatusFilter = {
  statuses: StatusFiscal[] | undefined;
  slug: string;
};

export function parseExportStatuses(url: URL): ExportStatusFilter {
  const { status } = parseProductListParams(url);
  if (status) {
    return { statuses: [status], slug: STATUS_TO_EXPORT_SLUG[status] };
  }
  const somente = (url.searchParams.get("somente") ?? "").trim().toLowerCase();
  if (somente === "todos") {
    return { statuses: undefined, slug: "cadastro" };
  }
  const mapped = SOMENTE_TO_STATUS[somente];
  if (mapped) {
    return { statuses: [mapped], slug: STATUS_TO_EXPORT_SLUG[mapped] };
  }
  return { statuses: undefined, slug: "cadastro" };
}

export function treatedWhere(
  tratado: TreatedFilter,
): { treatedAt: null } | { treatedAt: { not: null } } | Record<string, never> {
  if (tratado === "nao") return { treatedAt: null };
  if (tratado === "sim") return { treatedAt: { not: null } };
  return {};
}

export function dashboardTotalsFromBatch(batch: {
  totalRows: number;
  corretos: number;
  divergentes: number;
  analise: number;
} | null): {
  total: number;
  corretos: number;
  divergentes: number;
  analise: number;
} {
  if (!batch) {
    return { total: 0, corretos: 0, divergentes: 0, analise: 0 };
  }
  return {
    total: batch.totalRows,
    corretos: batch.corretos,
    divergentes: batch.divergentes,
    analise: batch.analise,
  };
}

export function auditCounterDeltas(
  previous: string | null | undefined,
  next: StatusFiscal,
): { corretos: number; divergentes: number; analise: number } {
  const deltas = { corretos: 0, divergentes: 0, analise: 0 };
  function bump(status: string | null | undefined, dir: 1 | -1) {
    if (status === "CORRETO") deltas.corretos += dir;
    else if (status === "DIVERGENTE") deltas.divergentes += dir;
    else if (status === "NECESSITA_ANALISE") deltas.analise += dir;
  }
  bump(previous, -1);
  bump(next, 1);
  return deltas;
}

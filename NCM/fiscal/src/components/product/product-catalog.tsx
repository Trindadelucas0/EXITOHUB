"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { FiscalGrid } from "@/src/components/grid/fiscal-grid";
import { DiffTable } from "@/src/components/product/diff-table";
import { BatchSelector, type BatchOption } from "@/src/components/product/batch-selector";
import {
  productSheetColumns,
  productUsesUnicaLayout,
} from "@/src/components/product/product-sheet-columns";
import type { ProductSheetItem } from "@/src/components/product/product-sheet-types";
import { NcmSummary } from "@/src/components/product/ncm-summary";
import { SegmentoSummary, type SegmentoOption } from "@/src/components/product/segmento-summary";
import {
  ProductFilters,
  parseStatusFilter,
  type ProductFilterValues,
} from "@/src/components/product/product-filters";
import { useActiveBatch } from "@/src/components/product/use-active-batch";
import { useProductQuery } from "@/src/components/product/use-product-query";
import { Button } from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/empty-state";
import { PageHeader } from "@/src/components/ui/page-header";
import { Pagination } from "@/src/components/ui/pagination";
import { ncmApiUrl } from "@/src/lib/base-path";
import type { FieldDiff } from "@/src/lib/fiscal";

type CatalogSlot =
  | ReactNode
  | ((batchId: string | null, batches: BatchOption[], filters: ProductFilterValues) => ReactNode);

function renderSlot(
  slot: CatalogSlot | undefined,
  batchId: string | null,
  batches: BatchOption[],
  filters: ProductFilterValues,
) {
  if (slot == null) return null;
  return typeof slot === "function" ? slot(batchId, batches, filters) : slot;
}

export function ProductCatalog({
  kicker,
  title,
  description,
  actions,
  defaultStatus = "",
  rowMode,
  extra,
  hideTreatedDefault = false,
  showNcmSummary = false,
}: {
  kicker: string;
  title: string;
  description: string;
  actions?: CatalogSlot;
  defaultStatus?: ProductFilterValues["status"];
  rowMode: "navigate" | "expand";
  extra?: CatalogSlot;
  hideTreatedDefault?: boolean;
  showNcmSummary?: boolean;
  reloadKey?: number;
}) {
  const router = useRouter();
  const { batchId, batches, batchBooted, loteFromUrl, searchParams, onBatchChange } = useActiveBatch();
  const [filters, setFilters] = useState<ProductFilterValues>({
    q: searchParams.get("q") ?? "",
    ncm: searchParams.get("ncm") ?? "",
    segmento: searchParams.get("segmento") ?? "",
    status: parseStatusFilter(searchParams.get("status"), defaultStatus),
    tratado: hideTreatedDefault ? "nao" : "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [queueTick, setQueueTick] = useState(0);
  const [canWrite, setCanWrite] = useState(false);
  const [segmentoOptions, setSegmentoOptions] = useState<SegmentoOption[]>([]);
  const { rows, summary, catalogTotal, total, pageCount, loading, error, layout } = useProductQuery(
    filters,
    batchId,
    batchBooted || Boolean(loteFromUrl),
    page,
    pageSize,
    queueTick,
  );

  useEffect(() => {
    fetch(ncmApiUrl("/api/auth/me"))
      .then((r) => r.json())
      .then((json) => setCanWrite(Boolean(json.data?.canWrite)))
      .catch(() => setCanWrite(false));
  }, []);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [filters, batchId]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function activate(row: ProductSheetItem) {
    if (rowMode === "expand") {
      setExpandedId((current) => (current === row.id ? null : row.id));
      return;
    }
    const params = batchId ? `?lote=${encodeURIComponent(batchId)}` : "";
    router.push(`/consulta/${row.id}${params}`);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker={kicker}
        title={title}
        description={description}
        actions={renderSlot(actions, batchId, batches, filters)}
      />
      {renderSlot(extra, batchId, batches, filters)}
      <ProductFilters
        values={filters}
        summary={summary}
        onChange={setFilters}
        resetStatus={defaultStatus}
        hideTreatedDefault={hideTreatedDefault}
        segmentoOptions={segmentoOptions}
        lead={
          <BatchSelector compact preferredId={loteFromUrl} onChange={onBatchChange} />
        }
      />
      <SegmentoSummary
        lote={batchId}
        status={filters.status}
        tratado={filters.tratado}
        activeSegmento={filters.segmento}
        onSelect={(segmento) => setFilters((current) => ({ ...current, segmento, ncm: "" }))}
        onGroups={setSegmentoOptions}
      />
      {showNcmSummary ? (
        <NcmSummary
          lote={batchId}
          status={filters.status}
          tratado={filters.tratado}
          segmento={filters.segmento}
          activeNcm={filters.ncm}
          onSelect={(ncm) => setFilters((current) => ({ ...current, ncm }))}
          onQueueChange={() => setQueueTick((tick) => tick + 1)}
          refreshKey={queueTick}
        />
      ) : null}
      {error ? <p className="text-sm text-status-bad">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title={
            batches.length === 0
              ? "Nenhum produto no cadastro"
              : catalogTotal === 0
                ? "Esta planilha não tem produtos"
                : "Nenhum resultado"
          }
          description={
            batches.length === 0
              ? canWrite
                ? "A consulta fica vazia até a importação de um arquivo."
                : "Ainda não há planilha importada. Peça ao administrador para importar o cadastro."
              : catalogTotal === 0
                ? "Escolha outra planilha no seletor acima ou importe um cadastro."
                : "Nenhum produto combina com os filtros. Limpe a busca, mude a situação ou escolha outra planilha."
          }
          actionHref={batches.length === 0 && canWrite ? "/importar" : undefined}
          actionLabel={batches.length === 0 && canWrite ? "Importar cadastro" : undefined}
        />
      ) : null}
      {loading || rows.length > 0 ? (
        <>
          <p className="text-sm text-ink-muted">
            {loading
              ? "Buscando…"
              : `${total} produto${total === 1 ? "" : "s"} · mostrando ${from}–${to}`}
          </p>
          <FiscalGrid
            caption={title}
            columns={productSheetColumns(
              productUsesUnicaLayout(layout, rows) ? "unica" : "matriz",
            )}
            rows={rows}
            getRowId={(row) => row.id}
            loading={loading}
            expandedId={rowMode === "expand" ? expandedId : null}
            onRowActivate={activate}
            renderExpanded={
              rowMode === "expand"
                ? (item) => <ExpandedProduct item={item} batchId={batchId} />
                : undefined
            }
          />
          <Pagination
            page={page}
            pageCount={pageCount}
            onPage={setPage}
            pageSize={pageSize}
            onPageSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            label={`Paginação: ${title}`}
          />
        </>
      ) : null}
    </div>
  );
}

function ExpandedProduct({
  item,
  batchId,
}: {
  item: ProductSheetItem;
  batchId: string | null;
}) {
  const lote = batchId ? `?lote=${encodeURIComponent(batchId)}` : "";
  const [diffs, setDiffs] = useState<FieldDiff[]>(item.diffs);
  const [motivo, setMotivo] = useState(item.motivo);
  const [needsLink, setNeedsLink] = useState(item.needsLink);

  useEffect(() => {
    const controller = new AbortController();
    fetch(ncmApiUrl(`/api/products/${item.id}`), { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Falha");
        setDiffs(json.data.compare?.diffs ?? []);
        setMotivo(json.data.compare?.motivo ?? item.motivo);
        setNeedsLink(Boolean(json.data.compare?.needsLink));
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [item.id, item.motivo]);

  return (
    <div className="grid gap-3 text-sm">
      <p className="text-ink">{motivo}</p>
      {item.treated ? (
        <p className="rounded-md border border-line bg-paper-sunken px-3 py-2">
          {item.treatedStale
            ? "Tratado no lote anterior — a situação fiscal mudou. Confira de novo ou desmarque na ficha."
            : "Já tratado nesta fila."}
          {item.treatedNote ? ` ${item.treatedNote}` : ""}
        </p>
      ) : null}
      {needsLink ? (
        <p className="rounded-md border border-status-warn bg-status-warn-bg px-3 py-2">
          Este NCM tem duas regras. Vincule a hipótese na ficha antes de corrigir o cadastro.
        </p>
      ) : null}
      <DiffTable diffs={diffs} />
      <div className="flex flex-wrap gap-2">
        <Link href={`/consulta/${item.id}${lote}`}>
          <Button variant="primary">Ver ficha</Button>
        </Link>
        <Link href={`/como-dar-entrada/${item.id}${lote}`}>
          <Button variant="secondary">Como dar entrada</Button>
        </Link>
      </div>
    </div>
  );
}

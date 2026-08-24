"use client";

import { Button } from "@/src/components/ui/button";

const PAGE_SIZES = [25, 50, 100];

export function Pagination({
  page,
  pageCount,
  onPage,
  label,
  pageSize,
  onPageSize,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  label: string;
  pageSize?: number;
  onPageSize?: (size: number) => void;
}) {
  if (pageCount <= 1 && !onPageSize) return null;
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label={label}>
      {pageCount > 1 ? (
        <>
          <Button
            variant="secondary"
            className="flex-1 sm:flex-none"
            disabled={page <= 1}
            onClick={() => onPage(Math.max(1, page - 1))}
          >
            Anterior
          </Button>
          <p className="w-full text-center text-sm text-ink-muted sm:w-auto">
            Página {page} de {pageCount}
          </p>
          <Button
            variant="secondary"
            className="flex-1 sm:flex-none"
            disabled={page >= pageCount}
            onClick={() => onPage(Math.min(pageCount, page + 1))}
          >
            Próxima
          </Button>
        </>
      ) : null}
      {onPageSize && pageSize ? (
        <label className="flex w-full items-center gap-2 text-sm text-ink-muted sm:ml-auto sm:w-auto">
          Linhas
          <select
            className="min-h-11 flex-1 rounded-md border border-line-strong bg-white px-2 text-base text-ink sm:flex-none md:text-sm"
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </nav>
  );
}

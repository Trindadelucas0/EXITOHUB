"use client";

import { Fragment, type KeyboardEvent, type ReactNode } from "react";

export type ColumnShow = "always" | "md" | "lg" | "xl";

export type FiscalColumn<T> = {
  id: string;
  header: string;
  sticky?: 1 | 2 | 3;
  className?: string;
  show?: ColumnShow;
  cell: (row: T) => ReactNode;
};

function showClass(show?: ColumnShow): string {
  if (!show || show === "always") return "";
  if (show === "md") return "hidden md:table-cell";
  if (show === "lg") return "hidden lg:table-cell";
  return "hidden xl:table-cell";
}

export function FiscalGrid<T>({
  caption,
  columns,
  rows,
  getRowId,
  loading = false,
  selectedId,
  expandedId,
  onRowActivate,
  renderExpanded,
}: {
  caption: string;
  columns: FiscalColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  loading?: boolean;
  selectedId?: string | null;
  expandedId?: string | null;
  onRowActivate?: (row: T) => void;
  renderExpanded?: (row: T) => ReactNode;
}) {
  function onKey(row: T, event: KeyboardEvent<HTMLTableRowElement>) {
    if (!onRowActivate) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowActivate(row);
    }
  }

  const visibleCount = columns.length;

  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs text-ink-muted xl:hidden">Deslize a tabela para o lado para ver mais colunas.</p>
      <div className="fiscal-grid-wrap">
        <table className="fiscal-grid">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={`${column.sticky ? `sticky-col sticky-col-${column.sticky}` : ""} ${showClass(column.show)} ${column.className ?? ""}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }, (_, index) => (
                  <tr key={`skeleton-${index}`} aria-hidden>
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={`${column.sticky ? `sticky-col sticky-col-${column.sticky}` : ""} ${showClass(column.show)}`}
                      >
                        <span className="inline-block h-3 w-12 animate-pulse rounded bg-line" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const id = getRowId(row);
                  const selected = selectedId === id;
                  const expanded = expandedId === id;
                  return (
                    <Fragment key={id}>
                      <tr
                        tabIndex={onRowActivate ? 0 : undefined}
                        data-selected={selected ? "true" : undefined}
                        onClick={onRowActivate ? () => onRowActivate(row) : undefined}
                        onKeyDown={onRowActivate ? (event) => onKey(row, event) : undefined}
                        className={onRowActivate ? "cursor-pointer" : undefined}
                      >
                        {columns.map((column) => (
                          <td
                            key={column.id}
                            className={`${column.sticky ? `sticky-col sticky-col-${column.sticky}` : ""} ${showClass(column.show)} ${column.className ?? ""}`}
                          >
                            {column.cell(row)}
                          </td>
                        ))}
                      </tr>
                      {expanded && renderExpanded ? (
                        <tr className="bg-white">
                          <td colSpan={visibleCount} className="whitespace-normal p-3">
                            {renderExpanded(row)}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

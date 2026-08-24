export type BatchDiffKind = "added" | "removed" | "ncm_changed" | "status_changed" | "unchanged";

export type BatchDiffRow = {
  codigo: string;
  ncm: string;
  auditStatus: string | null;
};

export type BatchDiffItem = {
  kind: BatchDiffKind;
  codigo: string;
  currentNcm: string | null;
  previousNcm: string | null;
  currentStatus: string | null;
  previousStatus: string | null;
};

export type BatchDiffSummary = {
  added: number;
  removed: number;
  ncmChanged: number;
  statusChanged: number;
  unchanged: number;
};

export function diffBatchRows(current: BatchDiffRow[], previous: BatchDiffRow[]): {
  items: BatchDiffItem[];
  summary: BatchDiffSummary;
} {
  const prevByCodigo = new Map<string, BatchDiffRow>();
  for (const row of previous) prevByCodigo.set(row.codigo, row);
  const currentCodes = new Set(current.map((row) => row.codigo));

  const items: BatchDiffItem[] = [];
  let unchanged = 0;
  for (const row of current) {
    const before = prevByCodigo.get(row.codigo);
    if (!before) {
      items.push({
        kind: "added",
        codigo: row.codigo,
        currentNcm: row.ncm,
        previousNcm: null,
        currentStatus: row.auditStatus,
        previousStatus: null,
      });
      continue;
    }
    if (before.ncm !== row.ncm) {
      items.push({
        kind: "ncm_changed",
        codigo: row.codigo,
        currentNcm: row.ncm,
        previousNcm: before.ncm,
        currentStatus: row.auditStatus,
        previousStatus: before.auditStatus,
      });
      continue;
    }
    if (before.auditStatus !== row.auditStatus) {
      items.push({
        kind: "status_changed",
        codigo: row.codigo,
        currentNcm: row.ncm,
        previousNcm: before.ncm,
        currentStatus: row.auditStatus,
        previousStatus: before.auditStatus,
      });
      continue;
    }
    unchanged += 1;
  }
  for (const row of previous) {
    if (currentCodes.has(row.codigo)) continue;
    items.push({
      kind: "removed",
      codigo: row.codigo,
      currentNcm: null,
      previousNcm: row.ncm,
      currentStatus: null,
      previousStatus: row.auditStatus,
    });
  }

  const summary: BatchDiffSummary = {
    added: 0,
    removed: 0,
    ncmChanged: 0,
    statusChanged: 0,
    unchanged,
  };
  for (const item of items) {
    if (item.kind === "added") summary.added += 1;
    else if (item.kind === "removed") summary.removed += 1;
    else if (item.kind === "ncm_changed") summary.ncmChanged += 1;
    else if (item.kind === "status_changed") summary.statusChanged += 1;
  }
  return { items, summary };
}

export function filterDiffItems(
  items: BatchDiffItem[],
  tipo: BatchDiffKind | "",
): BatchDiffItem[] {
  if (tipo) return items.filter((item) => item.kind === tipo);
  return items.filter((item) => item.kind !== "unchanged");
}

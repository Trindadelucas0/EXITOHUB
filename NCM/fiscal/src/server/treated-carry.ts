export type PreviousMarker = {
  codigo: string;
  auditStatus: string | null;
  treatedAt: Date | null;
  treatedByUserId: string | null;
  treatedNote: string | null;
};

export type CarryResult = {
  treatedAt: Date | null;
  treatedByUserId: string | null;
  treatedNote: string | null;
  treatedStale: boolean;
};

const EMPTY: CarryResult = {
  treatedAt: null,
  treatedByUserId: null,
  treatedNote: null,
  treatedStale: false,
};

export function indexPreviousMarkers(rows: PreviousMarker[]): Map<string, PreviousMarker> {
  const map = new Map<string, PreviousMarker>();
  for (const row of rows) {
    map.set(row.codigo, row);
  }
  return map;
}

export function carryTreatedMarker(
  keep: boolean,
  codigo: string,
  newStatus: string | null,
  previousByCodigo: Map<string, PreviousMarker>,
): CarryResult {
  if (!keep || newStatus === "CORRETO" || !newStatus) return EMPTY;
  const previous = previousByCodigo.get(codigo);
  if (!previous?.treatedAt) return EMPTY;
  return {
    treatedAt: previous.treatedAt,
    treatedByUserId: previous.treatedByUserId,
    treatedNote: previous.treatedNote,
    treatedStale: Boolean(previous.auditStatus && previous.auditStatus !== newStatus),
  };
}

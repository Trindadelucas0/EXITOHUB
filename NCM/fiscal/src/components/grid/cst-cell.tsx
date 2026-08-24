import { cstCellsDiverge, displayCst } from "@/src/lib/fiscal";

export function CstCell({
  atual,
  ideal,
  compare = false,
}: {
  atual?: string | null;
  ideal?: string | null;
  compare?: boolean;
}) {
  const shown = displayCst(compare ? atual : (atual ?? ideal));
  const mismatch = compare && cstCellsDiverge(atual, ideal);
  return (
    <span
      className={`tabular ${mismatch ? "rounded-sm bg-status-bad-bg px-1 py-0.5 text-status-bad" : ""}`}
      title={mismatch ? `Como deve ficar: ${displayCst(ideal)}` : undefined}
    >
      {shown}
    </span>
  );
}

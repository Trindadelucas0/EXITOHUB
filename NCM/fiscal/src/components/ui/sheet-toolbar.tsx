import type { ReactNode } from "react";

export function SheetToolbar({ children }: { children: ReactNode }) {
  return (
    <section className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper-raised/95 p-2 shadow-panel backdrop-blur">
      {children}
    </section>
  );
}

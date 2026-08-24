import type { ReactNode } from "react";

export function SheetToolbar({ children }: { children: ReactNode }) {
  return (
    <section className="sticky top-3 z-20 flex flex-wrap items-center gap-2 rounded-[20px] bg-white p-2 shadow-panel">
      {children}
    </section>
  );
}

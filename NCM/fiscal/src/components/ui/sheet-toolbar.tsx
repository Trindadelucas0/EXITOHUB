export function SheetToolbar({ children }: { children: React.ReactNode }) {
  return (
    <section className="sticky top-[4.25rem] z-20 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-2 shadow-panel">
      {children}
    </section>
  );
}

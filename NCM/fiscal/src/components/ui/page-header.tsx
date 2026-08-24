export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {kicker ? (
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/90">
            {kicker}
          </p>
        ) : null}
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-white/90">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div> : null}
    </div>
  );
}

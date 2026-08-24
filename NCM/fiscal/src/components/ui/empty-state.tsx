import Link from "next/link";
import { Button } from "./button";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white px-6 py-12 text-center">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{description}</p>
      {actionHref && actionLabel ? (
        <div className="mt-6">
          <Link href={actionHref}>
            <Button>{actionLabel}</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

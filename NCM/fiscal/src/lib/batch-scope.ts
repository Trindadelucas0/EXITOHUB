export function productsOfBatch<T extends { importBatchId: string }>(
  products: T[],
  batchId: string,
): T[] {
  return products.filter((item) => item.importBatchId === batchId);
}

export function resolveDisplayedBatchId(
  batches: { id: string }[],
  preferredId: string | null | undefined,
  cookieActiveId: string | null | undefined,
): string {
  if (preferredId && batches.some((batch) => batch.id === preferredId)) {
    return preferredId;
  }
  if (cookieActiveId && batches.some((batch) => batch.id === cookieActiveId)) {
    return cookieActiveId;
  }
  return batches[0]?.id ?? "";
}

export function batchBelongsToCompany(
  batch: { id: string; companyId: string } | null,
  companyId: string,
): boolean {
  return Boolean(batch && batch.companyId === companyId);
}

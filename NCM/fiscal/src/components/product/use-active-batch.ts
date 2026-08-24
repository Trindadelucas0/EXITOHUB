"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { syncLoteInUrl } from "@/src/lib/active-lote";
import type { BatchOption } from "./batch-selector";

export function useActiveBatch() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loteFromUrl = searchParams.get("lote");
  const [batchId, setBatchId] = useState<string | null>(loteFromUrl);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchBooted, setBatchBooted] = useState(Boolean(loteFromUrl));

  function onBatchChange(id: string | null, list: BatchOption[]) {
    setBatches(list);
    setBatchBooted(true);
    setBatchId(id);
    syncLoteInUrl(pathname, searchParams.toString(), id);
  }

  return {
    batchId,
    batches,
    batchBooted,
    loteFromUrl,
    searchParams,
    onBatchChange,
    active: batches.find((batch) => batch.id === batchId),
  };
}

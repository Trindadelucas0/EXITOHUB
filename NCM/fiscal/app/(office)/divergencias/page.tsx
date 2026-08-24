"use client";

import { ExportActions } from "@/src/components/product/export-actions";
import { ProductCatalog } from "@/src/components/product/product-catalog";

export default function DivergenciasPage() {
  return (
    <ProductCatalog
      kicker="Relatório"
      title="Divergências"
      description="Escolha a planilha e veja só as divergências dela. Clique na linha para ver o que veio errado no importado e como a regra fiscal manda ficar. Itens já tratados ficam ocultos por padrão."
      defaultStatus="DIVERGENTE"
      hideTreatedDefault
      showNcmSummary
      rowMode="expand"
      actions={(batchId, _batches, filters) => (
        <ExportActions batchId={batchId} tratado={filters.tratado} />
      )}
    />
  );
}

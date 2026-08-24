"use client";

import { ProductCatalog } from "@/src/components/product/product-catalog";

export default function ConsultaPage() {
  return (
    <ProductCatalog
      kicker="Produto"
      title="Consulta fiscal"
      description="Escolha a planilha importada para ver só os dados dela. Filtre por código, descrição, NCM ou situação e clique na linha para abrir a ficha."
      rowMode="navigate"
    />
  );
}

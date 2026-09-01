-- Egaplast: IVA/ICMS por UF da mercadoria importada (origem 1/2/…), separado do nacional.
ALTER TABLE "fiscal_ncm_rules"
  ADD COLUMN "iva_por_uf_importado" JSONB;

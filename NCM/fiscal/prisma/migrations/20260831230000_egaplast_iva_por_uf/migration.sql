-- Egaplast: IVA/ICMS por UF no cadastro e na regra CST+IVA.
ALTER TABLE "fiscal_ncm_rules"
  ADD COLUMN "iva_por_uf" JSONB;

ALTER TABLE "products"
  ADD COLUMN "origem" TEXT,
  ADD COLUMN "iva_por_uf" JSONB;

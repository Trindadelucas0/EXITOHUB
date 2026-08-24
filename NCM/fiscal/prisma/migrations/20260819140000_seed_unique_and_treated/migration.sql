-- Dedup regras (mantém a mais antiga) antes do unique (company, ncm, situação).
DELETE FROM "fiscal_ncm_rules" AS a
USING "fiscal_ncm_rules" AS b
WHERE a."company_id" = b."company_id"
  AND a."ncm" = b."ncm"
  AND a."situacao_codigo" = b."situacao_codigo"
  AND a."created_at" > b."created_at"
  AND NOT EXISTS (
    SELECT 1 FROM "product_rule_links" l WHERE l."rule_id" = a."id"
  );

CREATE UNIQUE INDEX "fiscal_ncm_rules_company_id_ncm_situacao_codigo_key"
  ON "fiscal_ncm_rules"("company_id", "ncm", "situacao_codigo");

ALTER TABLE "products" ADD COLUMN "treated_at" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN "treated_by_user_id" TEXT;
ALTER TABLE "products" ADD COLUMN "treated_note" TEXT;
ALTER TABLE "products" ADD COLUMN "treated_stale" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "products_company_id_import_batch_id_treated_at_idx"
  ON "products"("company_id", "import_batch_id", "treated_at");

ALTER TABLE "products"
  ADD CONSTRAINT "products_treated_by_user_id_fkey"
  FOREIGN KEY ("treated_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

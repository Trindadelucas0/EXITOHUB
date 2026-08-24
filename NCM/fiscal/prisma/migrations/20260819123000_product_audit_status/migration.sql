-- AlterTable
ALTER TABLE "products" ADD COLUMN "audit_status" TEXT;
ALTER TABLE "products" ADD COLUMN "audit_motivo" TEXT;

-- CreateIndex
CREATE INDEX "products_company_id_import_batch_id_audit_status_idx" ON "products"("company_id", "import_batch_id", "audit_status");

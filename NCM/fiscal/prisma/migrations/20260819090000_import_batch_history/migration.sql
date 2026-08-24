-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN "corretos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "import_batches" ADD COLUMN "divergentes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "import_batches" ADD COLUMN "analise" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "products_company_id_import_batch_id_idx" ON "products"("company_id", "import_batch_id");

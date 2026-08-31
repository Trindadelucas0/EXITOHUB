-- Unica UF layout: CEST, IPI, abreviação, redução e MVA/alíquota por UF.
ALTER TABLE "fiscal_ncm_rules"
  ADD COLUMN "cest" TEXT,
  ADD COLUMN "ipi" TEXT,
  ADD COLUMN "abreviacao" TEXT,
  ADD COLUMN "reducao" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reducao_percentual" DECIMAL(8,4),
  ADD COLUMN "uf_tributacao" JSONB;

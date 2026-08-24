-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'consulta');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_company_id_email_key" ON "users"("company_id", "email");
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_company_id_user_id_idx" ON "sessions"("company_id", "user_id");

-- CreateTable
CREATE TABLE "fiscal_ncm_rules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "ncm" TEXT NOT NULL,
    "ncm_original" TEXT NOT NULL,
    "segmento" TEXT NOT NULL,
    "cst_entrada" TEXT,
    "cst_saida" TEXT,
    "cfop_saida" TEXT,
    "destinos_cst" JSONB NOT NULL,
    "situacao" TEXT NOT NULL,
    "situacao_codigo" TEXT NOT NULL,
    "mva_percentual" DECIMAL(8,4),
    "mva_texto" TEXT,
    "mva_kind" TEXT NOT NULL DEFAULT 'skip',
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fiscal_ncm_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fiscal_ncm_rules_company_id_ncm_idx" ON "fiscal_ncm_rules"("company_id", "ncm");
CREATE INDEX "fiscal_ncm_rules_company_id_situacao_codigo_idx" ON "fiscal_ncm_rules"("company_id", "situacao_codigo");

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_batches_company_id_created_at_idx" ON "import_batches"("company_id", "created_at");

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ncm" TEXT NOT NULL,
    "ncm_original" TEXT NOT NULL,
    "aliquota_icms" TEXT,
    "iva_mva" TEXT,
    "iva_mva_numero" DECIMAL(8,4),
    "cest" TEXT,
    "cst_compra" TEXT,
    "cst_unico" TEXT,
    "destinos_cst" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "products_company_id_ncm_idx" ON "products"("company_id", "ncm");
CREATE INDEX "products_company_id_codigo_idx" ON "products"("company_id", "codigo");

-- CreateTable
CREATE TABLE "product_rule_links" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_rule_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_rule_links_company_id_product_id_key" ON "product_rule_links"("company_id", "product_id");
CREATE INDEX "product_rule_links_company_id_rule_id_idx" ON "product_rule_links"("company_id", "rule_id");

-- FKs
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fiscal_ncm_rules" ADD CONSTRAINT "fiscal_ncm_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_rule_links" ADD CONSTRAINT "product_rule_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_rule_links" ADD CONSTRAINT "product_rule_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_rule_links" ADD CONSTRAINT "product_rule_links_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "fiscal_ncm_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolamento por tenant (RLS). O app define app.company_id por transação.
-- FORCE impede bypass pelo dono da tabela.
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "companies" FORCE ROW LEVEL SECURITY;
CREATE POLICY companies_tenant ON "companies"
  USING (id = current_setting('app.company_id', true));

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY users_tenant ON "users"
  USING (company_id = current_setting('app.company_id', true));

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY sessions_tenant ON "sessions"
  USING (company_id = current_setting('app.company_id', true));

ALTER TABLE "fiscal_ncm_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fiscal_ncm_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY fiscal_ncm_rules_tenant ON "fiscal_ncm_rules"
  USING (company_id = current_setting('app.company_id', true));

ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY import_batches_tenant ON "import_batches"
  USING (company_id = current_setting('app.company_id', true));

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
CREATE POLICY products_tenant ON "products"
  USING (company_id = current_setting('app.company_id', true));

ALTER TABLE "product_rule_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_rule_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY product_rule_links_tenant ON "product_rule_links"
  USING (company_id = current_setting('app.company_id', true));

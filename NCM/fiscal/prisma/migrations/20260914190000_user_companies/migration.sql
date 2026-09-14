-- Vínculo N:N usuário ↔ empresas (mesmo login em várias empresas).

CREATE TABLE IF NOT EXISTS "user_companies" (
  "user_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  CONSTRAINT "user_companies_pkey" PRIMARY KEY ("user_id", "company_id"),
  CONSTRAINT "user_companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_companies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_companies_company_id_idx" ON "user_companies"("company_id");

INSERT INTO "user_companies" ("user_id", "company_id")
SELECT "id", "company_id" FROM "users" WHERE "company_id" IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "user_companies" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_companies_select_all ON "user_companies";
CREATE POLICY user_companies_select_all ON "user_companies"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS user_companies_write_all ON "user_companies";
CREATE POLICY user_companies_write_all ON "user_companies"
  USING (true)
  WITH CHECK (true);

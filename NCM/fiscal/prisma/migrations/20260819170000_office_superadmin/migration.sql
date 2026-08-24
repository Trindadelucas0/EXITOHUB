-- Admin do escritório (sem empresa) e login só por e-mail.

ALTER TYPE "UserRole" ADD VALUE 'superadmin';

DROP INDEX "users_company_id_email_key";

ALTER TABLE "users" ALTER COLUMN "company_id" DROP NOT NULL;
ALTER TABLE "sessions" ALTER COLUMN "company_id" DROP NOT NULL;

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

DROP POLICY IF EXISTS users_tenant ON "users";
CREATE POLICY users_tenant ON "users"
  USING (
    company_id IS NULL
    OR company_id = current_setting('app.company_id', true)
  );

DROP POLICY IF EXISTS sessions_tenant ON "sessions";
CREATE POLICY sessions_tenant ON "sessions"
  USING (
    company_id IS NULL
    OR company_id = current_setting('app.company_id', true)
  );

-- Login autentica sem tenant na transação (mesmo padrão de companies_select_all).
CREATE POLICY users_select_all ON "users"
  FOR SELECT
  USING (true);

CREATE POLICY sessions_select_all ON "sessions"
  FOR SELECT
  USING (true);

CREATE POLICY sessions_delete_all ON "sessions"
  FOR DELETE
  USING (true);

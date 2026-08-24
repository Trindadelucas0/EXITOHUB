-- Escritório entra na empresa: a sessão guarda o tenant escolhido.
-- Usuário de empresa nunca usa esta coluna (o tenant dele vem de users.company_id).

ALTER TABLE "sessions" ADD COLUMN "active_company_id" TEXT;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_company_id_fkey"
  FOREIGN KEY ("active_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "sessions_active_company_id_idx" ON "sessions"("active_company_id");

-- A sessão do escritório (company_id NULL) precisa poder gravar o tenant ativo.
-- Sessão de empresa continua presa ao próprio company_id.
DROP POLICY IF EXISTS sessions_tenant ON "sessions";
CREATE POLICY sessions_tenant ON "sessions"
  USING (
    company_id IS NULL
    OR company_id = current_setting('app.company_id', true)
  )
  WITH CHECK (
    company_id IS NULL
    OR company_id = current_setting('app.company_id', true)
  );

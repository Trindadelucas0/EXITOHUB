-- Lista de empresas no login e no cadastro admin.
-- INSERT/UPDATE/DELETE seguem a policy companies_tenant (id = app.company_id).
CREATE POLICY companies_select_all ON "companies"
  FOR SELECT
  USING (true);

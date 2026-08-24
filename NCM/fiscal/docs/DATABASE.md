# Banco de dados

PostgreSQL. Nome do database: `fiscal-p` (hífen; em SQL use `"fiscal-p"`).  
ORM: Prisma. Migrations em `prisma/migrations`.

Credenciais **somente** em `.env` (`DATABASE_URL`, `DB_*`). Nenhuma variável `NEXT_PUBLIC_*` aponta para o banco.

## Tabelas

| Tabela | Papel |
| --- | --- |
| `companies` | Empresa (BAIFER no seed) |
| `users` | E-mail único, hash bcrypt, papel `superadmin`, `admin` ou `consulta`. Superadmin sem `company_id`. |
| `sessions` | Token hasheado, expiração. `active_company_id` guarda a empresa que o escritório abriu (só vale para `superadmin`) |
| `fiscal_ncm_rules` | Uma linha por NCM + situação (`company_id, ncm, situacao_codigo` unique) |
| `products` | Cadastro importado (sempre ligado a um lote); `audit_status`, `treated_at` |
| `product_rule_links` | Vínculo produto → regra (NCM duplicado) |
| `import_batches` | Histórico de cada planilha (arquivo, data, totais da conferência) |

Toda tabela de negócio tem `company_id`. Consultas usam `findFirst({ id, companyId })`.

## RLS

Policies por `company_id` = `current_setting('app.company_id')` com `FORCE ROW LEVEL SECURITY`.  
A conexão local usa o papel `postgres` (superuser), que **bypassa RLS**. Em produção deve-se usar um role sem `BYPASSRLS`. O filtro de tenant na aplicação permanece obrigatório.

## Seed

Empresa BAIFER + Loja + admin + consulta + regras + administrador do escritório. **Não apaga lotes.**  
Usuário já existente não tem senha resetada. Regras são atualizadas no lugar (o id permanece para não quebrar vínculo).  
Wipe explícito do cadastro: `SEED_RESET_CADASTRO=1 npm run db:seed`.

# Segurança

Implementado neste MVP:

- Autenticação no servidor; senha com bcrypt; sessão em cookie HttpOnly + SameSite; Secure quando `NODE_ENV=production`.
- Sem JWT no `localStorage`.
- RBAC `superadmin` | `admin` | `consulta` nas rotas (não só no menu).
- Tenant: `companyId` em toda query de negócio; IDOR → 404. O tenant é resolvido no servidor (`resolveCompanyScope`), nunca pelo cliente.
- Escritório só lê produtos/regras da empresa que abriu explicitamente; sem empresa aberta as rotas fiscais devolvem `403`. Usuário de empresa ignora qualquer empresa ativa na sessão.
- Cadastro de empresas e de usuários só para `superadmin`. Lista pública de empresas no login foi removida.
- Upload: allowlist `.xlsx/.csv/.ods`, limite 8 MB, nome sanitizado.
- SQL via Prisma parametrizado; sem concatenação de input.
- XSS: React escapa texto; PDF usa `escapeHtml` antes de interpolar.
- CSRF: cookie SameSite=Lax + mesmas origens; não há cookie em domínio cruzado.
- Rate limit em memória no login (8 tentativas / 10 min por IP).
- Headers: CSP, nosniff, frame deny, referrer, permissions.
- Segredos só em `.env` (gitignored). `.env.example` sem senha real. Seed usa `SEED_ADMIN_PASSWORD` e `SEED_SUPERADMIN_PASSWORD`.
- Logs de senha: não registrados.

Não implementado atualmente:

- HTTPS no ambiente local.
- Role de banco sem superuser (local usa `postgres`).
- CSRF token adicional.
- Backup automatizado.
- Auditoria completa de cada consulta (há lote de importação).
- WAF / captcha.

# Deploy

Não há servidor de produção configurado neste repositório.

Fluxo previsto:

```
Git → npm ci → prisma migrate deploy → npm run db:seed (só na 1ª vez) → next build → next start
```

Variáveis (valores secretos nunca neste arquivo):

- `DATABASE_URL`
- `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD`
- `SESSION_SECRET`
- `SEED_ADMIN_EMAIL` `SEED_ADMIN_PASSWORD`
- `SEED_SUPERADMIN_EMAIL` `SEED_SUPERADMIN_PASSWORD`
- `NODE_ENV=production`

Produção deve usar HTTPS para o cookie `Secure`.  
Python é necessário só para reextrair as planilhas quando a regra mudar (`python tools/extract_rules.py`), não no runtime do Next.js.

Porta padrão de desenvolvimento: 3000.

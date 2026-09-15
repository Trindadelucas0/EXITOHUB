# Deploy

Não há servidor de produção configurado neste repositório.

Fluxo previsto:

```
Git → npm ci → prisma migrate deploy → npm run db:seed (só na 1ª vez) → next build → next start
```

No desenvolvimento via HUB (`npm run dev` na raiz), o Next do NCM sobe **sem** `migrate deploy`. Depois de puxar migrations novas, rode `npm run db:migrate` em `NCM/fiscal` antes de abrir Consulta/Divergências.

## Produção (VPS Êxito)

App PM2 `exito-hub`, pasta `/home/exito/projetos/EXITOHUB`, HTTP na porta **3010** ([`ecosystem.config.cjs`](../../../ecosystem.config.cjs)).

```bash
cd /home/exito/projetos/EXITOHUB
git pull origin main
npm ci
# Prisma usa DATABASE_URL; no .env do HUB o valor está em NCM_DATABASE_URL
cd NCM/fiscal && npx prisma generate && npm run db:migrate && cd ../..
pm2 restart exito-hub
```

O boot cria `CONCI.user_empresas` e roda `ensureMasterUser` (login `exito`). Não copie `.env` de outra máquina.

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

# Arquitetura

```
Usuário (navegador)
   ↓
Next.js App Router (React + Tailwind)
   ↓
Route Handlers /api (contrato da API)
   ↓
Serviços TypeScript em src/server (comparação, importação, auth, tenant)
   ↓
Prisma (SQL parametrizado)
   ↓
PostgreSQL (database "fiscal-p")
```

Python **não** sobe como API. Roda em `tools/extract_rules.py`: primeira aba do `OK.xlsx` → `data/base-baifer.json`; aba `LOJA` do ODS → `data/base-loja.json`. O seed grava cada JSON na empresa correspondente.

## Separação

- React não acessa o banco.
- `src/server` usa `server-only` e não deve ser importado em Client Components.
- Tipos visuais compartilhados ficam em `src/lib/fiscal.ts`.

## Mobile / desktop ready

O MVP é web. As regras estão na API, então um futuro cliente Capacitor, Flutter ou Tauri pode consumir `/api/*` sem reescrever o motor. Não há app mobile nem desktop implementados.

## Decisões

**Decisão:** Next.js full-stack em um repo.  
**Motivo:** equipe pequena, um deploy, Route Handlers suficientes para o MVP.  
**Alternativas:** API Python + front separado (rejeitado: Python só na extração da planilha).

**Decisão:** matriz CST por destinatário, não um CST único.  
**Motivo:** cada empresa tem 8 colunas; ST INTERNO na BAIFER mistura 0 e 10, na Loja o mesmo NCM pode ser 5102/0.

**Decisão:** produtos só por importação.  
**Motivo:** a aba Planilha_Classes_Fiscais não é fonte confiável neste MVP.

**Decisão:** login só com e-mail e senha; admin do escritório separado da BAIFER.  
**Motivo:** a BAIFER é uma empresa auditada, não o dono do sistema.  
**Alternativas:** seletor de empresa no login (rejeitado: expunha a lista e misturava papéis).

**Decisão:** o escritório entra na empresa gravando `active_company_id` na sessão, e o tenant sai de `resolveCompanyScope` no servidor.  
**Motivo:** o escritório precisa conferir cada empresa sem usar o login dela, e sem que o cliente escolha o tenant a cada requisição.  
**Alternativas:** `companyId` por header/querystring em cada chamada (rejeitado: o cliente passaria a decidir o tenant) e um login por empresa para o escritório (rejeitado: volta a espalhar senha).

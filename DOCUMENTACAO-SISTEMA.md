# EXITO HUB — Documentação do sistema

> Fonte oficial de comportamento do monorepo **EXITO HUB** (Folha, Conciliação, NCM).
> Versão: 1.2.1 — Abrev. Unica na Base fiscal (seed Atacadista + ABREVIACAO).

## 1. Visão geral

Um servidor Express (`hub/server.js`) monta três módulos:

| Prefixo | Módulo | App |
|---------|--------|-----|
| `/folha` | Folha & Fiscal | BeatrizDt |
| `/conci` | Conciliação | CONCI |
| `/ncm` | Auditor NCM | Next.js (NCM/fiscal) |

Login único em `/login`. Permissões em `exito_hub.hub_user_modules`.

## 2. Cadastro de usuários (fonte única)

**Usuários são criados somente em `/admin/usuarios`** (admin do HUB).

| Passo | Onde | O quê |
|-------|------|-------|
| 1 | `/conci/admin/empresas` ou `/ncm/escritorio/empresas` | Cadastrar **empresa** (sem usuário) |
| 2 | `/admin/usuarios` | Criar usuário, marcar módulo(s), vincular empresa Conci/NCM |
| 3 | `/login` | Entrar com usuário ou e-mail + senha do HUB |

O HUB provisiona automaticamente:

- **Conciliação** → `CONCI.users` (papel `admin` ou `empresa` + `empresa_id`)
- **NCM** → `fiscal-p.users` (papel `admin` ou `consulta` + `company_id`)
- **Folha** → sessão espelhada do HUB (sem tabela própria em modo HUB)

Código: [`hub/provision-modules.js`](hub/provision-modules.js), [`hub/auth.js`](hub/auth.js) (`createUser`, `updateUserWithModules`).

## 3. Login → destino

| Persona | Login | `landing_path` | Bloqueio |
|---------|-------|----------------|----------|
| Admin HUB (2+ módulos) | usuário ou e-mail | `/` (home) | [`requireHubAdmin`](hub/middleware.js) em `/admin/*` |
| Admin Conciliação | username | `/conci/admin/empresas` | `requireAdmin` no Conci |
| Empresa Conci | username | `/conci/` | `requireEmpresa` + `empresa_id` |
| Empresa NCM | e-mail | `/ncm/dashboard` | [`resolveCompanyScope`](NCM/fiscal/src/server/company-scope.ts) |
| Só Folha | usuário ou e-mail | `/folha/modulos` | [`requireHubModule('folha')`](hub/server.js) |

Função: [`postLoginPath`](hub/auth.js).

## 4. Menu e permissões

O menu (EJS [`hub/views/partials/hub-app-menu.ejs`](hub/views/partials/hub-app-menu.ejs) e React [`hub-systems-menu.tsx`](NCM/fiscal/src/components/shell/hub-systems-menu.tsx)) mostra **apenas** módulos em `hub_user_modules`.

Rotas sem módulo → 403 via [`requireHubModule`](hub/middleware.js).

**Papéis distintos:**

- `hub_users.is_admin` — administra usuários do HUB (`/admin/usuarios`)
- `CONCI.users.role = 'admin'` — administra empresas/bancos Conci
- `fiscal-p.users.role = 'superadmin'` — escritório NCM (seed interno)

## 5. SSO por módulo

### Conciliação

[`resolveHubSso`](CONCI/CONCI/conciliação/src/middleware/session.js) busca `CONCI.users` pelo `hub.username`. Se não existir → tela `sso-missing`.

### NCM

[`getUserFromHubCookie`](NCM/fiscal/src/server/hub-sso.ts) busca `fiscal-p.users` pelo `hub.email` com módulo `ncm`.

## 6. Scripts de manutenção

```bash
npm run validate:login          # valida personas no banco
npm run reconcile:modules:dry     # simula correção de módulos fantasmas
npm run reconcile:modules         # aplica correção (Conci/NCM módulo único)
```

## 7. Mapa tela → código

| Tela | Rota | Arquivo principal |
|------|------|-------------------|
| Login HUB | GET/POST `/login` | [`hub/routes.js`](hub/routes.js) |
| Usuários HUB | `/admin/usuarios` | [`hub/views/admin-users.ejs`](hub/views/admin-users.ejs) |
| Empresas Conci | `/conci/admin/empresas` | [`adminEmpresas.ejs`](CONCI/CONCI/conciliação/views/adminEmpresas.ejs) |
| Empresas NCM | `/ncm/escritorio/empresas` | NCM escritório |
| Base fiscal NCM | `/ncm/base-fiscal` | Importa regras da empresa aberta |
| Auth/me NCM | `/ncm/api/auth/me` | [`route.ts`](NCM/fiscal/app/api/auth/me/route.ts) |

Empresas NCM no seed: **BAIFER**, **Loja das Máquinas**, **Unica** (`slug` `unica`). Login da equipe Unica continua em `/admin/usuarios` (HUB), não no seed do HUB.

### Import de regras NCM

Tela **Base fiscal** (`POST /ncm/api/rules/import`). Parser: [`import-rules.ts`](NCM/fiscal/src/server/import-rules.ts). Layouts: [`NCM/fiscal/data/calibracao/layouts.json`](NCM/fiscal/data/calibracao/layouts.json).

| Empresa | Arquivo típico | Aba | O que grava |
|---------|----------------|-----|-------------|
| BAIFER | ODS aba `BAIFER` ou XLSX `TRIBUTACAO NCM BAIFER` (`Planilha1`) | matriz 8 destinos | CST/CFOP/MVA (sem coluna de abreviação) |
| Loja | ODS aba `LOJA` ou XLSX Lojão (`Planilha1`) | matriz 8 destinos sem CST BAIFER | CFOP `5,405` → `5405` (sem coluna de abreviação) |
| Unica (oficial / seed) | `TRIBUTACAO NCM UNICA ATACADISTA` (`Planilha3`) | NCM, CEST, **ABREVIACAO**, MVA/alíquota DF·GO·MG | situação `TRIBUTACAO_UF` + Abrev. na Base fiscal |
| Unica (variante) | `PLANILHA REGRA FISCAL UNICA.xlsx` | mesmos campos **sem** `ABREVIACAO` | no update, coluna ausente **não apaga** abreviação já gravada |

Cadastro de **produtos** Unica continua sendo o CSV (`Cód.Item`, `Novo NCM`, `Desc. Abrev. ICMS`) na tela **Planilhas** — não veio nestas planilhas de tributação. A coluna **Abrev.** da Base fiscal Unica vem da `ABREVIACAO` da planilha Atacadista (ex.: NCM `25202090` → `4`).

## 8. Guia rápido

1. Crie empresas nos módulos Conci e NCM.
2. Em `/admin/usuarios`, crie o login: marque Conciliação ou NCM, escolha empresa e papel.
3. Admin Conciliação: papel **Admin Conciliação**, módulo só Conci → menu sem Folha/NCM.
4. Empresa NCM: e-mail + módulo NCM + empresa → `/ncm/dashboard` ao logar.
5. Escritório NCM: em Empresas, **Entrar** na Unica → **Base fiscal** para ver CEST, **Abrev.** e alíquotas DF/GO/MG (125 NCMs no seed; Abrev. preenchida a partir da Atacadista).

Guia expandido: [`README.md`](README.md). Detalhe do auditor: [`NCM/fiscal/README.md`](NCM/fiscal/README.md).

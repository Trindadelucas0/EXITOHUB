# EXITO HUB — Documentação do sistema

> Fonte oficial de comportamento do monorepo **EXITO HUB** (Folha, Conciliação, NCM).
> Versão: 1.3.11 — Egaplast: IVA da regra por origem (Nacional / Importado); coluna cadastro do cliente.

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
| Consulta NCM | `/ncm/consulta` | Grade do lote; Unica: Abreviação/CEST + **Filtrar segmento** |
| Divergências NCM | `/ncm/divergencias` | Fila Unica por segmento, depois por NCM |
| Auth/me NCM | `/ncm/api/auth/me` | [`route.ts`](NCM/fiscal/app/api/auth/me/route.ts) |

Empresas NCM no seed: **BAIFER**, **Loja das Máquinas**, **Unica** (`slug` `unica`), **Egaplast** (`slug` `egaplast`). Login da equipe Unica/Egaplast continua em `/admin/usuarios` (HUB), não no seed do HUB.

### Import de regras NCM

Tela **Base fiscal** (`POST /ncm/api/rules/import`). Parser: [`import-rules.ts`](NCM/fiscal/src/server/import-rules.ts). Layouts: [`NCM/fiscal/data/calibracao/layouts.json`](NCM/fiscal/data/calibracao/layouts.json).

| Empresa | Arquivo típico | Aba | O que grava |
|---------|----------------|-----|-------------|
| BAIFER | ODS aba `BAIFER` ou XLSX `TRIBUTACAO NCM BAIFER` (`Planilha1`) | matriz 8 destinos | CST/CFOP/MVA (sem coluna de abreviação) |
| Loja | ODS aba `LOJA` ou XLSX Lojão (`Planilha1`) | matriz 8 destinos sem CST BAIFER | CFOP `5,405` → `5405` (sem coluna de abreviação) |
| Unica (oficial / seed) | `TRIBUTACAO NCM UNICA ATACADISTA` (`Planilha3`) | NCM, CEST, **ABREVIACAO**, MVA/alíquota DF·GO·MG | situação `TRIBUTACAO_UF` + Abrev. na Base fiscal |
| Unica (variante) | `PLANILHA REGRA FISCAL UNICA.xlsx` | mesmos campos **sem** `ABREVIACAO` | preenche Abrev. pelo NCM da base Atacadista (ex.: `25202090` → `4`); NCM fora dessa base continua sem Abrev. e no update **não apaga** valor já gravado |
| Egaplast (oficial) | `TRIBUTACAO NCM EGAPLAST` (aba `Planilha1`) | NCM, CEST, segmento, MVA/alíquota DF·GO·MG (mesmo layout da Unica, **sem** Abrev. da Unica) | situação `TRIBUTACAO_UF`; só a empresa `egaplast`. NCMs de 7 dígitos ou `0` são ignorados. **Não** compara o fator IVA do cadastro (ex. `1.9424`) com o MVA % desta planilha (ex. `27.31`) |
| Egaplast (variante) | `planilha egaplast.xls` (abas `Dados` + `Planilha1`) | NCM, CST (`SIT.TRIBUTÁRIA`), IVA/ICM **por UF** (27 estados), segmento = capítulo TIPI | regras CST+IVA; `iva_por_uf` = maioria **nacional**; `iva_por_uf_importado` = maioria **importada**. NCMs só na listagem ficam `INCOMPLETA`. Só a empresa `egaplast` lê as duas abas como regra. Convive com `TRIBUTACAO_UF`: o seed **não apaga** essas regras |

Cadastro de **produtos** Unica continua sendo o CSV (`Cód.Item`, `Novo NCM`, `Novo Abreviação Fiscal`, `Desc. Abrev. ICMS`) na tela **Planilhas** — não veio nestas planilhas de tributação. A coluna **Abrev.** da Base fiscal Unica vem da `ABREVIACAO` da planilha Atacadista (ex.: NCM `25202090` → `4`). Se a Base fiscal for atualizada com `PLANILHA REGRA FISCAL UNICA.xlsx` (sem essa coluna), o import **completa** a Abrev. com o mesmo mapa Atacadista por NCM — não deixa a coluna em branco. Na conferência Unica (`TRIBUTACAO_UF`), o item fica **CORRETO** quando a Abreviação do cadastro bate com a da base (`004` = `4`); CEST e MVA só entram se o CSV trouxer esses campos. `Desc. Abrev. ICMS` (ex.: `000 18 0`) grava só o CST — **não** é comparado com a alíquota interna DF da base (senão o lote inteiro virava divergente). **Consulta e Divergências** da Unica mostram Abreviação, CEST, Aliq. DF (da base) e MVA. Na barra há **Filtrar segmento**. **Egaplast** usa o mesmo filtro de segmento. Se a Base fiscal veio de `TRIBUTACAO NCM EGAPLAST`, a conferência é **NCM na base** (CEST só se o cadastro tiver CEST; o fator IVA **não** entra contra o MVA %). NCM só na Planilha1 usa CST+IVA. Consulta mostra SP; a ficha lista UF | Cadastro do cliente | Como deve ficar · Nacional/Importado. A grade da Base fiscal mostra CEST e alíquotas DF/GO/MG, **sem** copiar Abrev. da Unica. Sem Abreviação e sem matriz de 8 destinatários. **BAIFER/Loja** não veem esses chips e não comparam Abreviação — continuam na matriz de 8 destinatários.

### Import de cadastro (Planilhas)

Tela **Planilhas** (`POST /ncm/api/import`). Parser: [`import-cadastro.ts`](NCM/fiscal/src/server/import-cadastro.ts). Extensões: `.xlsx`, `.xls`, `.csv`, `.ods` (até 8 MB).

| Origem | Arquivo típico | O que lê |
|--------|----------------|----------|
| Santri | Relação de Classes Fiscais / aba `Planilha_Classes_Fiscais` | código, nome, NCM, 8 destinos, IVA compra |
| Unica | CSV `Cód.Item` | NCM + Abreviação fiscal + CST/alíquota via Desc. Abrev. ICMS |
| Egaplast listagem | `ncm.xls` / aba `Dados` | CÓDIGO, NOME, NCM (NCM `0` → vazio); ~4153 produtos |
| Egaplast relatório | aba `Planilha1` / `relatorio de produtos.xlsx` | blocos com código, origem, SIT.TRIBUTÁRIA, NCM + IVA/ICM das 27 UFs (até 4 linhas de pares UF+valor, **pula linha em branco** no meio); `ivaMva` = SP; dedupe → ~1127 códigos |
| Egaplast combinado | `planilha egaplast.xls` (duas abas) na empresa Egaplast | nome de `Dados` + CST/IVA de `Planilha1` pelo código |

A conferência compara o lote com a **base fiscal da empresa da sessão**. Na Egaplast a regra oficial a importar é `TRIBUTACAO NCM EGAPLAST.xlsx` (NCM/CEST/UF). O `.xls` de duas abas continua válido como variante CST+IVA (compara CST e cada UF do bloco, mesma unidade, **Nacional e Importado em mapas separados**) e **convive** com `TRIBUTACAO_UF` — o seed não apaga a tributação NCM. Com só TRIBUTACAO NCM, o NCM na base fica **CORRETO** — o fator `1.9424` não é confrontado com `27.31%`. Se o NCM estiver só na Planilha1 (ex.: `40129090`), CST e IVA corretos vêm dessa regra. Se o NCM não existir em nenhuma das duas, o errado é o NCM (como está / como deve ficar: um NCM da Base fiscal). **Consulta** e **Divergências** mostram SP e “ver ficha”. Ficha e **Como dar entrada** listam as 27 UFs em **UF | Cadastro do cliente | Como deve ficar · Nacional/Importado**; a coluna da regra vem da origem do produto e permanece preenchida mesmo se o cadastro não tiver IVA. Vermelho só no cadastro se a mesma UF daquela origem divergir. Listagem/relatório na tela Planilhas é o **cadastro**. Importar o mesmo layout em BAIFER/Loja/Unica **não** ativa o parser Egaplast.

## 8. Guia rápido

1. Crie empresas nos módulos Conci e NCM.
2. Em `/admin/usuarios`, crie o login: marque Conciliação ou NCM, escolha empresa e papel.
3. Admin Conciliação: papel **Admin Conciliação**, módulo só Conci → menu sem Folha/NCM.
4. Empresa NCM: e-mail + módulo NCM + empresa → `/ncm/dashboard` ao logar.
5. Escritório NCM: em Empresas, **Entrar** na Unica → **Base fiscal** para ver CEST, **Abrev.** e alíquotas DF/GO/MG. Pode importar a Atacadista ou `PLANILHA REGRA FISCAL UNICA.xlsx` (esta última não tem coluna Abrev.; o sistema completa pelo NCM). Importe o CSV em **Planilhas**. No **Panorama**, o card **Corretos** são os itens cuja Abreviação bate com a base (`004` = `4`). **Consulta** e **Divergências**: na barra, **Filtrar segmento** escolhe Autopeças, Tintas, Fora da base etc. **Divergências** mostra só o que não bateu (Abreviação diferente ou NCM fora da base).
6. Egaplast: em Empresas, **Entrar** na Egaplast → **Base fiscal** → Importar `TRIBUTACAO NCM EGAPLAST.xlsx` (NCM, CEST, segmento, alíquotas DF/GO/MG). Se precisar de CST+IVA por UF, importe também `planilha egaplast.xls` — as duas bases ficam juntas. Em **Planilhas**, importe o cadastro do cliente. **Consulta** filtra por segmento e mostra SP; a lista completa de UFs está na ficha e em Como dar entrada (cadastro do cliente | como deve ficar Nacional ou Importado). NCM só no `.xls` usa a regra CST+IVA. NCM em nenhuma base: o errado é o NCM — abra **Base fiscal**. O fator IVA não é comparado com o MVA % da TRIBUTACAO.

Guia expandido: [`README.md`](README.md). Detalhe do auditor: [`NCM/fiscal/README.md`](NCM/fiscal/README.md).

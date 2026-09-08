# EXITO HUB — Documentação do sistema

> Fonte oficial de comportamento do monorepo **EXITO HUB** (Folha, Conciliação, NCM).
> Versão: 1.3.25 — Login consulta NCM da BAIFER: `consulta.baifer` / `consulta@baifer.local` (não o `baifer` da Conciliação).

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

Persona pronta de consulta da BAIFER: seed [`hub/seed-baifer-consulta.js`](hub/seed-baifer-consulta.js) (`npm run seed:baifer-consulta` ou no boot do HUB). Usuário `consulta.baifer` / e-mail `consulta@baifer.local`, módulo só NCM, papel `consulta`, empresa BAIFER. **Não** use o usuário `baifer` — esse é da Conciliação. Senha via `HUB_SEED_BAIFER_CONSULTA_PASSWORD` ou `SEED_ADMIN_PASSWORD` (não fica na documentação).

### 2.1 Histórico de versões

| Versão | Data | O que mudou |
|--------|------|-------------|
| 1.3.25 | 08/09/2026 | Login consulta NCM da BAIFER é `consulta.baifer` / `consulta@baifer.local`; `baifer` continua Conciliação |
| 1.3.24 | 08/09/2026 | `npm run dev` / `npm start` usam `--max-old-space-size=4096` para o Next do NCM não estourar o heap |
| 1.3.23 | 08/09/2026 | Login consulta BAIFER; consulta não exporta Excel/PDF nem acessa Planilhas |
| 1.3.22 | 08/09/2026 | NCM Egaplast: SKU com SIT+IVA (10200) vai para Divergências; linha sem SIT (10255) permanece Análise |

## 3. Login → destino

| Persona | Login | `landing_path` | Bloqueio |
|---------|-------|----------------|----------|
| Admin HUB (2+ módulos) | usuário ou e-mail | `/` (home) | [`requireHubAdmin`](hub/middleware.js) em `/admin/*` |
| Admin Conciliação | username | `/conci/admin/empresas` | `requireAdmin` no Conci |
| Empresa Conci | username | `/conci/` | `requireEmpresa` + `empresa_id` |
| Empresa NCM (admin) | e-mail | `/ncm/dashboard` | [`resolveCompanyScope`](NCM/fiscal/src/server/company-scope.ts) |
| Consulta BAIFER | `consulta.baifer` ou `consulta@baifer.local` | `/ncm/dashboard` | tenant BAIFER; sem Planilhas, sem Excel/PDF |
| Só Folha | usuário ou e-mail | `/folha/modulos` | [`requireHubModule('folha')`](hub/server.js) |

Função: [`postLoginPath`](hub/auth.js).

## 4. Menu e permissões

O menu (EJS [`hub/views/partials/hub-app-menu.ejs`](hub/views/partials/hub-app-menu.ejs) e React [`hub-systems-menu.tsx`](NCM/fiscal/src/components/shell/hub-systems-menu.tsx)) mostra **apenas** módulos em `hub_user_modules`.

Rotas sem módulo → 403 via [`requireHubModule`](hub/middleware.js).

**Papéis distintos:**

- `hub_users.is_admin` — administra usuários do HUB (`/admin/usuarios`)
- `CONCI.users.role = 'admin'` — administra empresas/bancos Conci
- `fiscal-p.users.role = 'superadmin'` — escritório NCM (seed interno)
- `fiscal-p.users.role = 'admin'` — importa, apaga lote, exporta Excel/PDF e altera a base fiscal da empresa vinculada
- `fiscal-p.users.role = 'consulta'` — só a empresa do `company_id`; vê Panorama, Consultar, Divergências e Base fiscal (leitura); marca já tratado; **não** lista outras empresas, não importa, não apaga lote, não exporta Excel/PDF. Menu **Planilhas** oculto; `GET /ncm/api/export/*` → 403

## 5. SSO por módulo

### Conciliação

[`resolveHubSso`](CONCI/CONCI/conciliação/src/middleware/session.js) busca `CONCI.users` pelo `hub.username`. Se não existir → tela `sso-missing`.

### NCM

[`getUserFromHubCookie`](NCM/fiscal/src/server/hub-sso.ts) busca `fiscal-p.users` pelo `hub.email` com módulo `ncm`.

## 6. Scripts de manutenção

```bash
npm run validate:login          # valida personas no banco
npm run seed:baifer-consulta     # cria/alinha login consulta só da BAIFER
npm run reconcile:modules:dry     # simula correção de módulos fantasmas
npm run reconcile:modules         # aplica correção (Conci/NCM módulo único)
cd NCM/fiscal && npm run db:migrate   # alinha o PostgreSQL fiscal-p ao Prisma (o HUB não aplica migrate no boot)
```

## 7. Mapa tela → código

| Tela | Rota | Arquivo principal |
|------|------|-------------------|
| Login HUB | GET/POST `/login` | [`hub/routes.js`](hub/routes.js) |
| Usuários HUB | `/admin/usuarios` | [`hub/views/admin-users.ejs`](hub/views/admin-users.ejs) |
| Empresas Conci | `/conci/admin/empresas` | [`adminEmpresas.ejs`](CONCI/CONCI/conciliação/views/adminEmpresas.ejs) |
| Pré-cadastro Conci | `/conci/pre-cadastro` | [`preCadastro.ejs`](CONCI/CONCI/conciliação/views/preCadastro.ejs) |
| Revisão Conci | `/conci/revisao/:id` | [`revisao.ejs`](CONCI/CONCI/conciliação/views/revisao.ejs) |
| Empresas NCM | `/ncm/escritorio/empresas` | NCM escritório |
| Base fiscal NCM | `/ncm/base-fiscal` | Importa regras da empresa aberta |
| Consulta NCM | `/ncm/consulta` | Grade do lote; Unica/Egaplast: **Filtrar segmento** na barra |
| Divergências NCM | `/ncm/divergencias` | Grade de divergências; Unica/Egaplast: **Filtrar segmento** na barra; exportar **Fora da base** (NCM ausente da regra) |
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
| Egaplast (oficial NCM/CEST/UF) | `TRIBUTACAO NCM EGAPLAST` (aba `Planilha1`) | NCM, CEST, segmento, MVA/alíquota DF·GO·MG (mesmo layout da Unica, **sem** Abrev. da Unica) | situação `TRIBUTACAO_UF`; só a empresa `egaplast`. NCMs de 7 dígitos ou `0` são ignorados. **Não** compara o fator IVA do cadastro (ex. `1.9424`) com o MVA % desta planilha (ex. `27.31`) |
| Egaplast (oficial CST+IVA) | `NCM REGRA FISCAL EXITO CONTABILIDADE X EGAPLAST.xlsx` (aba `Regra Tributária x Produtos`) | NCM, ORIGEM, SIT. TRIBUTÁRIA e IVA das 27 UFs em colunas `UF SIGNATÁRIO` (sem CÓDIGO/DESCRIÇÃO) | regras CST+IVA; `iva_por_uf` = maioria **nacional** (`0`/`9`); `iva_por_uf_importado` = maioria **importada** (`1`/`2`). Ouro: NCM `84818019` ST interno SP `1.9854` nacional / `2.1659` importado. Seed: 289 regras / 265 NCMs. Só a empresa `egaplast`. **Não** importa em Planilhas. Convive com `TRIBUTACAO_UF`: o seed **não apaga** essas regras |
| Egaplast (variante CST+IVA) | `planilha egaplast.xls` (abas `Dados` + `Planilha1`) | NCM, CST (`SIT.TRIBUTÁRIA`), IVA/ICM **por UF** (27 estados), segmento = capítulo TIPI | mesma lógica CST+IVA das duas abas; permanece como variante |

Cadastro de **produtos** Unica continua sendo o CSV (`Cód.Item`, `Novo NCM`, `Novo Abreviação Fiscal`, `Desc. Abrev. ICMS`) na tela **Planilhas** — não veio nestas planilhas de tributação. A coluna **Abrev.** da Base fiscal Unica vem da `ABREVIACAO` da planilha Atacadista (ex.: NCM `25202090` → `4`). Se a Base fiscal for atualizada com `PLANILHA REGRA FISCAL UNICA.xlsx` (sem essa coluna), o import **completa** a Abrev. com o mesmo mapa Atacadista por NCM — não deixa a coluna em branco. Na conferência Unica (`TRIBUTACAO_UF`), o item fica **CORRETO** quando a Abreviação do cadastro bate com a da base (`004` = `4`); CEST e MVA só entram se o CSV trouxer esses campos. `Desc. Abrev. ICMS` (ex.: `000 18 0`) grava só o CST — **não** é comparado com a alíquota interna DF da base (senão o lote inteiro virava divergente). **Consulta e Divergências** da Unica mostram Abreviação, CEST, Aliq. DF (da base) e MVA. Na barra há **Filtrar segmento** (não há chips de segmento nem fila de NCM). **Egaplast** usa o mesmo filtro de segmento. Se a Base fiscal veio de `TRIBUTACAO NCM EGAPLAST`, a conferência é **NCM na base** (CEST só se o cadastro tiver CEST; o fator IVA **não** entra contra o MVA %). NCM só na Planilha1 usa CST+IVA. Consulta mostra SP; a ficha lista UF | Cadastro do cliente | Como deve ficar · Nacional/Importado (IVA da regra CST+IVA; cadastro vazio = NADA INFORMADO). A grade da Base fiscal mostra CEST e alíquotas DF/GO/MG, **sem** copiar Abrev. da Unica. Sem Abreviação e sem matriz de 8 destinatários. **BAIFER/Loja** não veem **Filtrar segmento** e não comparam Abreviação — continuam na matriz de 8 destinatários.

### Import de cadastro (Planilhas)

Tela **Planilhas** (`POST /ncm/api/import`). Parser: [`import-cadastro.ts`](NCM/fiscal/src/server/import-cadastro.ts). Extensões: `.xlsx`, `.xls`, `.csv`, `.ods` (até 8 MB).

| Origem | Arquivo típico | O que lê |
|--------|----------------|----------|
| Santri | Relação de Classes Fiscais / aba `Planilha_Classes_Fiscais` | código, nome, NCM, 8 destinos, IVA compra |
| Unica | CSV `Cód.Item` | NCM + Abreviação fiscal + CST/alíquota via Desc. Abrev. ICMS |
| Egaplast (oficial) | `PLANILHA BASE DA TRIBUTAÇÃO CLIENTE EGAPLAST.xlsx` (aba `Regra Tributária x Produtos`; fixture `regra-tributaria-x-produtos-egaplast.xlsx`) | CÓDIGO, DESCRIÇÃO, NCM, ORIGEM, SIT. TRIBUTÁRIA e IVA das 27 UFs no cabeçalho; ~4153 produtos, ~1127 com CST+IVA. Ouro: `10100` NCM `84818019` origem `9-PRODUÇÃO` SP `1.9424` (**Correto** vs EXITO `1.9854`, dentro de 0,05); `10200` mesmo KIT origem `0-NACIONAL` SP `2.1190` (**Divergente** vs `1.9854`); `10255` sem SIT → **Análise**. **Não** importa na Base fiscal |
| Egaplast listagem (variante) | `ncm.xls` / aba `Dados` | CÓDIGO, NOME, NCM (NCM `0` → vazio); ~4153 produtos, sem IVA por UF |
| Egaplast relatório (variante) | aba `Planilha1` / `relatorio de produtos.xlsx` | blocos com código, origem, SIT.TRIBUTÁRIA, NCM + IVA/ICM das 27 UFs (até 4 linhas de pares UF+valor, **pula linha em branco** no meio); `ivaMva` = SP; dedupe → ~1127 códigos |
| Egaplast combinado (variante) | `planilha egaplast.xls` (duas abas) na empresa Egaplast | nome de `Dados` + CST/IVA de `Planilha1` pelo código |

A conferência compara o lote com a **base fiscal da empresa da sessão**. Na tela **Como dar entrada**, alertas e placeholders usam o **nome da empresa ativa** (ex.: “aba Loja das Máquinas”), não um rótulo fixo de BAIFER. O campo de divergência de CST de saída aparece como **CST saída** na grade e no export. Na Egaplast a regra oficial de NCM/CEST/UF é `TRIBUTACAO NCM EGAPLAST.xlsx`. A regra oficial CST+IVA (base do escritório) é `NCM REGRA FISCAL EXITO CONTABILIDADE X EGAPLAST.xlsx` — importe em **Base fiscal**, não em Planilhas. O cadastro oficial do cliente em **Planilhas** é `PLANILHA BASE DA TRIBUTAÇÃO CLIENTE EGAPLAST.xlsx` (~4153 SKUs com CÓDIGO; ouro `10100` SP `1.9424`). Esse arquivo **não** entra na Base fiscal — a tela avisa para usar Planilhas. O `.xls` de duas abas continua válido como variante CST+IVA (compara CST e cada UF do bloco, mesma unidade, **Nacional e Importado em mapas separados**) e **convive** com `TRIBUTACAO_UF` — o seed **não apaga** a tributação NCM. Com só TRIBUTACAO NCM, o NCM na base fica **CORRETO** — o fator `1.9424` não é confrontado com `27.31%`. Itens **com** SIT.TRIBUTÁRIA cruzam CST e cada UF com a regra CST+IVA, se ela existir no mesmo NCM (mesmo havendo TRIBUTACAO_UF). A coluna verde **Como deve ficar** preenche o IVA da regra CST+IVA (nacional ou importado; ouro EXITO SP `1.9854` / `2.1659` no NCM `84818019`). Se essa regra não tiver mapa (só TRIBUTACAO NCM), usa o IVA do cadastro importado — não deixa traço e não copia o MVA % (`27.31`). Se o cadastro não trouxe IVA (linha parcial, célula vazia), o lado do cliente mostra **NADA INFORMADO** — `0` informado pelo cliente continua `0`. A coluna verde não usa NADA INFORMADO; só fica `—` se não houver IVA na regra nem no cadastro. Se o NCM estiver só na regra CST+IVA (ex.: `40129090`), CST e IVA corretos vêm dessa regra. Se o NCM não existir em nenhuma das duas, o errado é o NCM (como está / como deve ficar: um NCM da Base fiscal). **Consulta** e **Divergências** mostram SP e “ver ficha”. Ficha e **Como dar entrada** listam as 27 UFs em **UF | Cadastro do cliente | Como deve ficar · Nacional/Importado**. Vermelho só no cadastro se a mesma UF daquela origem divergir. Listagem/relatório na tela Planilhas é o **cadastro**. Importar o layout SIGNATÁRIO em BAIFER/Loja/Unica é recusado (entre na Egaplast). O layout largo com CÓDIGO (SKU) é cadastro: em **Planilhas** entra; na **Base fiscal** é recusado.

### Conciliação — Classificação Êxito × histórico

Tela **Revisão** após enviar Extrato + Contas a Pagar. Pré-cadastro por empresa+banco em `/conci/pre-cadastro`. Código: [`preCadastroStore.js`](CONCI/CONCI/conciliação/src/services/preCadastroStore.js) (`findBestPreByHistorico`, `enrichCapFromHistorico`), [`orchestrator.js`](CONCI/CONCI/conciliação/src/services/matching/orchestrator.js), [`revisaoBulk.js`](CONCI/CONCI/conciliação/src/services/revisaoBulk.js).

| Situação | O que acontece |
|----------|----------------|
| Classificação Êxito já preenchida (Contas a Pagar ou edição) | Não sobrescreve. Débito/Crédito vêm da descrição igual no pré-cadastro |
| Classificação Êxito vazia | Procura a descrição do pré-cadastro no histórico do extrato (igualdade ou como palavra). A mais longa vence. Preenche CAP + Débito/Crédito; auto-aprova se houver códigos |
| `ENERGIA` no pré-cadastro e histórico `NEOENERGIA` | Não classifica (evita pedaço de outra palavra) |
| Recebimento (valor positivo) | Continua CAP `RECEBIMENTO`; não classifica pelo histórico |
| Cadastrou o pré-cadastro depois do upload | **Atualizar pré-cadastro** na revisão aplica a mesma regra. Salvar uma linha com CAP em branco também tenta o histórico |

## 8. Guia rápido

1. Crie empresas nos módulos Conci e NCM.
2. Em `/admin/usuarios`, crie o login: marque Conciliação ou NCM, escolha empresa e papel.
3. Admin Conciliação: papel **Admin Conciliação**, módulo só Conci → menu sem Folha/NCM.
4. Empresa Conci: em **Pré-cadastro**, cadastre a Classificação Êxito (descrição que aparece no histórico do extrato) e os códigos Débito/Crédito. Envie Extrato + Contas a Pagar. Na **Revisão**, o que não veio da planilha de CAP é classificado se a descrição estiver no histórico. Se cadastrou depois, clique **Atualizar pré-cadastro**.
5. Empresa NCM: e-mail + módulo NCM + empresa → `/ncm/dashboard` ao logar.
6. **Consulta BAIFER (NCM):** em `/login` use `consulta.baifer` ou `consulta@baifer.local` (senha do seed, não publicada). **Não** use `baifer` — esse usuário é da Conciliação. O NCM abre direto o dashboard da BAIFER. Vê Panorama, Consultar, Divergências e Base fiscal. Não vê outras empresas, não importa, não apaga lote, não baixa Excel/PDF. Para outro cliente consulta, o mesmo padrão: `/admin/usuarios` → NCM + empresa + papel Consulta.
7. Escritório NCM: em Empresas, **Entrar** na Unica → **Base fiscal** para ver CEST, **Abrev.** e alíquotas DF/GO/MG. Pode importar a Atacadista ou `PLANILHA REGRA FISCAL UNICA.xlsx` (esta última não tem coluna Abrev.; o sistema completa pelo NCM). Importe o CSV em **Planilhas**. No **Panorama**, o card **Corretos** são os itens cuja Abreviação bate com a base (`004` = `4`). **Consulta** e **Divergências**: na barra, **Filtrar segmento** escolhe Autopeças, Tintas, Fora da base etc. (não há chips nem fila de NCM). **Divergências** mostra só o que não bateu (Abreviação diferente ou NCM fora da base). Marcar como já tratado é na **ficha** do produto. Para baixar só os NCM que **não estão na regra** da empresa: **Incluir no arquivo → Fora da base → Exportar Excel** (lote inteiro, detalhado) — só admin da empresa ou escritório. Vale também para BAIFER, Loja e Egaplast.
8. Egaplast: em Empresas, **Entrar** na Egaplast → **Base fiscal** → Importar `TRIBUTACAO NCM EGAPLAST.xlsx` (NCM, CEST, segmento, alíquotas DF/GO/MG) e `NCM REGRA FISCAL EXITO CONTABILIDADE X EGAPLAST.xlsx` (CST+IVA SIGNATÁRIO — é a regra do escritório). As duas bases ficam juntas. Em **Planilhas**, importe o cadastro do cliente (`PLANILHA BASE DA TRIBUTAÇÃO CLIENTE EGAPLAST.xlsx`, com CÓDIGO). O arquivo EXITO SIGNATÁRIO **não** entra em Planilhas. Na ficha, **Como deve ficar** preenche o IVA da regra CST+IVA (ouro SP `1.9854` nacional / `2.1659` importado no NCM `84818019`); se a base só tiver TRIBUTACAO NCM, usa o IVA do cadastro (não deixa traço, não usa o MVA %). Cadastro sem IVA na UF = **NADA INFORMADO**. **Consulta** filtra por segmento e mostra SP. Busque pelo **código**: o mesmo NCM pode ter SKU Correto (`10100`) e Divergente (`10200`, origem 0 com IVA de importado). Linha sem SIT.TRIBUTÁRIA (`10255`) fica em **Análise** — não é erro de layout. NCM em nenhuma base e sem IVA no cadastro: o errado é o NCM — abra **Base fiscal**. O fator IVA não é comparado com o MVA % da TRIBUTACAO.

Guia expandido: [`README.md`](README.md). Detalhe do auditor: [`NCM/fiscal/README.md`](NCM/fiscal/README.md).

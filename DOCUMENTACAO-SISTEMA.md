# EXITO HUB — Documentação do sistema

> Fonte oficial de comportamento do monorepo **EXITO HUB** (Folha, Conciliação, NCM, Portal Corporativo).
> Versão: 1.5.21 — Portal: progresso sequencial nas áreas + EXITO em preview de onboarding.

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

A tela é uma **lista** (busca, módulo, situação) e um **sheet** à direita (`?novo=1` ou `?editar=:id`). Sem JavaScript os mesmos links/query ainda abrem o editor. Empresas continuam nos módulos, não nesta tela.

| Passo | Onde | O quê |
|-------|------|-------|
| 1 | `/conci/admin/empresas` ou `/ncm/escritorio/empresas` | Cadastrar **empresa** (sem usuário) |
| 2 | `/admin/usuarios` → **Novo usuário** | Login, e-mail, senha, foto opcional (jpeg/png/webp), módulos, papel e **uma ou mais** empresas Conci/NCM |
| 3 | `/admin/usuarios?editar=:id` | Corrigir nome, senha, foto, módulos, vínculos, Admin do HUB; desativar no rodapé |
| 4 | `/perfil` | O próprio usuário troca só a **foto** (login/e-mail só o admin) |
| 5 | `/login` | Entrar com usuário ou e-mail + senha do HUB |

Filtros GET (`q`, `mod`, `sit`) sobrevivem ao salvar. Usuário e e-mail **não** mudam na edição (SSO Conci/NCM). O admin **não** desativa nem tira o próprio Admin do HUB.

Foto de perfil: coluna `hub_users.photo_file_id` → `portal_files` → `/portal/media/:id` (mesmo padrão dos contatos). Sem foto, topbar e lista admin mostram iniciais. Topbar: avatar/nome clicáveis abrem `/perfil`.

```text
┌─ topbar ──────────────────────────────────────────────────────────┐
│ ☰  Êxito HUB / Portal    [🔔]  (foto) Nome          [ Sair ]     │
│                             dept                                   │
└────────────────────────────────────────────────────────────────────┘
```

Código: [`hub/views/admin-users.ejs`](hub/views/admin-users.ejs), [`hub/views/perfil.ejs`](hub/views/perfil.ejs), [`hub/views/partials/hub-chrome.ejs`](hub/views/partials/hub-chrome.ejs), [`hub/routes.js`](hub/routes.js), [`hub/provision-modules.js`](hub/provision-modules.js), [`hub/auth.js`](hub/auth.js) (`createUser`, `updateUserWithModules`, `setUserPhotoFileId`).

O HUB provisiona automaticamente:

- **Master EXITO** (seed `HUB_SEED_ADMIN_USER` / `HUB_SEED_ADMIN_EMAIL`, padrão `exito` / `escritorio@local`) → Admin do HUB + Folha + Conciliação admin (todas as empresas) + NCM `superadmin` (painel do escritório, todas as empresas). Garantido no boot (`ensureMasterUser`). Não exige marcar empresa no cadastro.
- **Conciliação** → `CONCI.users` (papel `admin` ou `empresa` + `empresa_id` principal) e `CONCI.user_empresas` (todas as empresas do login)
- **NCM** → `fiscal-p.users` (papel `superadmin` sem empresa, ou `admin`/`consulta` + `company_id` principal) e `fiscal-p.user_companies` (todas as empresas do login, se não for escritório). O INSERT do HUB gera `users.id` (`crypto.randomUUID`); o default `cuid()` do Prisma só vale no client Next, não no Postgres.
- **Folha** → sessão espelhada do HUB (sem tabela própria em modo HUB)

Persona pronta de consulta da BAIFER: seed [`hub/seed-baifer-consulta.js`](hub/seed-baifer-consulta.js) (`npm run seed:baifer-consulta` ou no boot do HUB). Usuário `consulta.baifer` / e-mail `consulta@baifer.local`, módulo só NCM, papel `consulta`, empresa BAIFER. **Não** use o usuário `baifer` — esse é da Conciliação. Senha via `HUB_SEED_BAIFER_CONSULTA_PASSWORD` ou `SEED_ADMIN_PASSWORD` (não fica na documentação).

### 2.1 Histórico de versões

| Versão | Data | O que mudou |
|--------|------|-------------|
| 1.5.21 | 24/09/2026 | Portal: progresso sequencial por usuário em Vídeos, Diagrama, Informativos, Catálogos e Documentos (`portal_item_progress`; POST `.../:id/complete`). Próximo item só libera após marcar o atual. Master EXITO deixa de forçar `COMPLETED` no boot; reset único (`portal_exito_onboarding_reset_v2`) coloca usuários seed/EXITO em PENDING. Seed TESTE nas 4 áreas se vazias. POPs sem progresso. Acompanhamento → PENDING limpa progresso de etapas e de itens |
| 1.5.20 | 24/09/2026 | Portal: tabelas `portal_announcements` e `portal_events`; Home e `/portal/comunicados` `/eventos` `/agenda` listam registros ativos (vazio se não houver). Boot [`hub/portal/seed-demo.js`](hub/portal/seed-demo.js) (trava `hub_meta.portal_demo_seed_v1`) grava comunicados/eventos/contatos de teste e as 7 faixas oficiais de Máquina do Tempo (YouTube 30PRAUM) em `portal_items` kind `video`, desativando vídeos ativos anteriores sem apagar. Sem admin CRUD nem sync Google Agenda |
| 1.5.19 | 24/09/2026 | Shell visual: canvas `#e4ebf5` (antes `#f9f9ff`); cards com borda `#d7e3fd` e sombra mais visível; gutter `--hub-gutter` (1.5rem / 1rem / 0.75rem) e stack `--hub-stack` (1.25rem) em Home, áreas, admin, perfil, projetos, login e empties. Sidebar e topbar com linha de separação. Cabeçalho `.hub-page-head` em Projetos, placeholders e Integração. Folha/Conci/NCM inalterados |
| 1.5.18 | 23/09/2026 | Menu lateral: departamentos abrem/fecham no clique (`<details>`); Contábil e Projetos sempre com o próprio nome; em Administrativo, Portal Corporativo, Gerenciar usuários e Acompanhamento ficam no subgrupo **Configuração** (`section: config` no catálogo). Página atual já abre o departamento (e Configuração). Gaveta do NCM segue o mesmo. `GET /api/hub/menu` inclui `section` |
| 1.5.17 | 23/09/2026 | Portal: Home sem teto 1100/1520px — o miolo (carrossel, comunicados, agenda, links) usa `width: 100%` na área ao lado da sidebar. Vídeos/POPs/módulo da trilha continuam com coluna max 1040px. Empilhamento tablet/celular inalterado |
| 1.5.16 | 23/09/2026 | Portal: abaixo de 1024px o carrossel empilha imagem e texto (16:9), o menu lateral continua gaveta e os links têm alvo de toque de 44px. Abaixo de 640px a saudação e a data ficam em coluna, os atalhos quebram linha, Comunicados/Eventos/Agenda ocupam a largura e o botão Sair do topo fica só o ícone. Inputs com 16px para não ampliar a tela no celular |
| 1.5.15 | 23/09/2026 | Portal: boot remove os 4 slides de exemplo (títulos Bem-vindo ao Êxito, Nossa equipe, Informações internas, Novidades do Êxito, texto “Foto de exemplo”). Se `portal_contents` ficar vazio, grava de novo o slide original com `principal.jpg`. Conteúdo já cadastrado pelo admin não é apagado |
| 1.5.14 | 23/09/2026 | Conciliação: `npm run migrate-conci` (raiz) aplica cada `.sql` de `CONCI/CONCI/conciliação/migrations/data` uma vez, registrando em `conci_data_migrations`. Primeiro arquivo: BAIFER ITAU 08/2026 (busca empresa e banco pelo nome; recusa se a empresa não existir). `--dry-run` lista o pendente |
| 1.5.13 | 23/09/2026 | Conciliação: Salvar/Aprovar/Rejeitar linha e ações em lote gravam em `conciliacoes` antes de atualizar a memória. Se o banco falhar, a resposta é HTTP 500 "Não foi possível salvar. Nada foi alterado, tente de novo." No boot, o pré-cadastro usa o JSON de `data/precadastro` quando ele é mais novo que `precadastros.updated_at` (gravação no banco que falhou) |
| 1.5.12 | 23/09/2026 | Conciliação: `.xlsx`/`.xls` de Contas a Pagar não cai mais no leitor de ODS. Se a planilha não tiver Nome, CNPJ e Valor, a tela mostra esse erro e não grava. ODS sem `content.xml` também avisa em vez de quebrar |
| 1.5.11 | 23/09/2026 | Portal: cada card da trilha é um módulo (`GET /portal/onboarding/etapas/:id`) com YouTube in-app, link para baixar o vídeo e PDF (upload). Admin cadastra na edição da etapa. Abrir na lista aponta para o módulo (não mais para rotas genéricas) |
| 1.5.10 | 23/09/2026 | Projetos (`/projetos`): hero + três canais (Suporte de TI e Infraestrutura, **Equipe de TI**, Solicitação de novos módulos). CTA Abrir Portal Avadesk. Sem KPI, SLA, SSO, fila ou pessoas fictícias do mockup |
| 1.5.9 | 23/09/2026 | Portal: layout/UX mais próximo do mockup Stitch — gutter 1.25rem, coluna Home 1520px, gap 1.5rem único, raios 0.5rem, shadow-sm, topbar padding 1.5rem + blur, sidebar sem borda no brand, carrossel Conteúdos com toolbar interna, lista usuários até 1600px |
| 1.5.8 | 23/09/2026 | Foto de perfil: `hub_users.photo_file_id` + upload no admin (criar/editar) e self-service em `/perfil`. Topbar e lista de usuários mostram imagem circular ou iniciais. Mídia via `/portal/media` |
| 1.5.7 | 23/09/2026 | Portal: `/portal/onboarding` com status `COMPLETED` mostra selo Integração concluída, barra 100%, Ir para a Home, atalhos (Vídeos, Diagrama, POPs, Documentos) e etapas em leitura (Abrir se houver rota). Contador 0/N não aparece mais nesse estado. Trilha em curso inalterada |
| 1.5.6 | 23/09/2026 | Portal: admin Conteúdos Êxito mostra tamanho recomendado da imagem (1280 × 720 px, 16:9, até 8 MB). Boot semeia 4 conteúdos de exemplo com fotos ([`hub/portal/seed-contents.js`](hub/portal/seed-contents.js)) só se `portal_contents` estiver vazio; o cliente troca depois |
| 1.5.5 | 23/09/2026 | Portal: área Logos retirada da Home (5 cards), menu, barra rápida e admin. `GET /portal/logos` redireciona para `/`. Itens `kind=logo` no banco permanecem sem tela. |
| 1.5.4 | 22/09/2026 | Portal: POPs com YouTube embutido in-app (como Vídeos); removidos CTAs “Abrir no YouTube” / “Abrir em nova aba” na visualização pública |
| 1.5.3 | 22/09/2026 | Portal: `/portal/pops` espelha Vídeos de Integração — featured in-app (PDF/imagem via `/portal/media`), trilha com `?p=`, Abrir em nova aba. Coluna max 1040px |
| 1.5.2 | 22/09/2026 | Portal: `/portal/videos` e `/portal/pops` em coluna max 1040px (Stitch). Player YouTube real contido; playlist e cards POP compactos (ícone+código+versão, sem capa 16/10 dominante). Sem duração/views/capítulos inventados |
| 1.5.1 | 22/09/2026 | Portal: faixa inferior da Home (Comunicados, Eventos, Agenda Êxito, Links, Contatos) no visual Stitch — empty states ricos, grade de links, linhas de contato. Placeholders `/portal/comunicados`, `/eventos`, `/agenda` com o mesmo empty. Sem inventar eventos/comunicados nem claim de sync Google Agenda |
| 1.5.0 | 22/09/2026 | Portal: shell com sidebar fixa + topbar (mockup Stitch). Verde `#006b2b`, fundo `#f9f9ff`. Home pendente/concluída, vídeos (player + grade), POPs com busca/filtro, trilha, admin em cards, KPIs em usuários. Menu inclui Acompanhamento e Agenda do portal. Sem SSO/SLA/matrícula do mockup |
| 1.4.6 | 22/09/2026 | Conciliação: histórico do extrato Itaú junta Lançamento e Razão Social (` - `; vazio = só lançamento). Sessão já gravada não muda; é preciso reenviar o extrato |
| 1.4.5 | 22/09/2026 | Conciliação: histórico e pré-cadastro ficam no Postgres. Admin reabre a última empresa. Edição que não gravar no banco mostra erro. Backup diário do banco CONCI |
| 1.4.4 | 21/09/2026 | Portal: `/portal/videos` em coluna única com player YouTube grande; assistir in-app (play no iframe). Link “Abrir no YouTube” secundário |
| 1.4.3 | 21/09/2026 | Portal: Vídeos de Integração usam link do YouTube (obrigatório); `/portal/videos` exibe iframe embed (`youtube-nocookie`). Sem upload de MP4 no admin de vídeos |
| 1.4.2 | 21/09/2026 | Portal: Home condicional (`PENDING`/`IN_PROGRESS` = banner + 6 cards; `COMPLETED` = barra rápida). Documentos Corporativos (`/portal/documentos`). Metadados em itens (departamento, versão, capa, obrigatório no onboarding). Empty states oficiais. Acompanhamento com filtros e progresso % |
| 1.4.1 | 21/09/2026 | Portal: cards da Home e itens de área (POPs, vídeos, etc.) com ilustração + nome, clicáveis. Arquivo de imagem do item vira capa; PDF/vídeo usa ilustração da área |
| 1.4.0 | 21/09/2026 | Portal Corporativo na Home `/`: cards, carrossel Conteúdos Êxito, links/contatos, áreas (vídeos, POPs, diagrama, informativos, catálogos, logos), trilha de onboarding (`onboarding_status`), admin em `/admin/portal`. Comunicados/Eventos/Agenda só placeholder. `postLoginPath` inalterado |
| 1.3.40 | 21/09/2026 | Conciliação: TAR/CUSTAS e TARIFA não casam Contas a Pagar só por valor+data (igual PIX). Histórico `TARIFA` (não TARIFARIO) → TARIFAS BANCARIAS + D/C do pré-cadastro |
| 1.3.39 | 16/09/2026 | Controle DAUTO: colunas Sistema Dauto e Local saem da grade, do mobile e do PDF. Ficam Nº Domínio, Empresa e impostos. Valores antigos de sistema/local continuam no registro, só não aparecem na tela |
| 1.3.38 | 16/09/2026 | Controle DAUTO: células editáveis de imposto usam máscara pt-BR (`R$ 2.268.291,00`) no HTML e no blur; foco tira `R$` para editar. Parse `2.268.291,00` / `2268291` / `R$ 2.268.291,00` é o mesmo número. Soma não muda; SALDO CREDOR continua fora do total |
| 1.3.37 | 16/09/2026 | Controle DAUTO / folha: `GET /folha/fiscal/pdf/:competencia` e `GET /folha/dashboard/pdf/:competencia` devolvem PDF binário (`Buffer` + `res.end`). Puppeteer 25 devolve `Uint8Array`; `res.send` virava JSON e o leitor recusava o arquivo |
| 1.3.36 | 15/09/2026 | Conciliação: residual sem CAP (não só TAR) classifica pelo histórico vs descrição do pré-cadastro; `TAR/CUSTAS` com prefixo (ex. BB) → TARIFAS BANCARIAS; auto-aprova com códigos; CAP da planilha não é sobrescrita |
| 1.3.35 | 15/09/2026 | Cadastro Master/NCM no HUB: `provisionNcmUser` envia `users.id` (UUID). Sem isso o Postgres rejeitava INSERT com id nulo (`cuid()` do Prisma não é DEFAULT no banco) |
| 1.3.34 | 14/09/2026 | Conci no HUB: forms/links do módulo usam `u()` + `CONCI_BASE_PATH` (`POST /conci/admin/empresas/:id`). `/admin/usuarios` e `/logout` continuam no HUB |
| 1.3.33 | 14/09/2026 | Panorama NCM: percentual nos cards, tratados/regras, donut de situação, top NCMs, segmentos (Unica/Egaplast) e sparkline dos lotes |
| 1.3.32 | 14/09/2026 | Produção: `/home/exito/projetos/EXITOHUB` + PM2 `exito-hub` (3010); migrate `user_companies`; boot master EXITO |
| 1.3.31 | 14/09/2026 | Login padrão EXITO (`HUB_SEED_ADMIN_*`, usuário `exito`) é master: Folha+Conci+NCM, Admin do HUB, Conci admin, NCM superadmin (todas as empresas). Checkbox Master no cadastro. |
| 1.3.30 | 14/09/2026 | `/admin/usuarios`: checkboxes de várias empresas em Conciliação (papel empresa) e NCM; troca da empresa ativa no módulo |
| 1.3.28 | 14/09/2026 | Usuários HUB: lista com chips + sheet direito (`?novo=1` / `?editar=`); filtro GET; sem form/senha na linha |
| 1.3.27 | 14/09/2026 | Menu hambúrguer por 7 departamentos (accordion); Auditor Fiscal = NCM; Projetos → Avadesk; itens novos só admin (página Em breve) |
| 1.3.26 | 08/09/2026 | Consulta BAIFER não vê Empresas/Usuários; cookie HUB manda e apaga `fiscal_session` antiga do escritório |
| 1.3.25 | 08/09/2026 | Login consulta NCM da BAIFER é `consulta.baifer` / `consulta@baifer.local`; `baifer` continua Conciliação |
| 1.3.24 | 08/09/2026 | `npm run dev` / `npm start` usam `--max-old-space-size=4096` para o Next do NCM não estourar o heap |
| 1.3.23 | 08/09/2026 | Login consulta BAIFER; consulta não exporta Excel/PDF nem acessa Planilhas |
| 1.3.22 | 08/09/2026 | NCM Egaplast: SKU com SIT+IVA (10200) vai para Divergências; linha sem SIT (10255) permanece Análise |

## 3. Login → destino

| Persona | Login | `landing_path` | Bloqueio |
|---------|-------|----------------|----------|
| Admin HUB / Master EXITO | `exito` ou `escritorio@local` | `/` (home) | todos os módulos; NCM escritório; Conci admin |
| Admin Conciliação | username | `/conci/admin/empresas` | `requireAdmin` no Conci |
| Empresa Conci | username | `/conci/` | `requireEmpresa` + empresas em `user_empresas` (ativa = `acting_empresa_id` ou `empresa_id`) |
| Empresa NCM (admin) | e-mail | `/ncm/dashboard` | [`resolveCompanyScope`](NCM/fiscal/src/server/company-scope.ts) |
| Consulta BAIFER | `consulta.baifer` ou `consulta@baifer.local` | `/ncm/dashboard` | tenant BAIFER; sem Empresas/Usuários, sem Planilhas, sem Excel/PDF |
| Só Folha | usuário ou e-mail | `/folha/modulos` | [`requireHubModule('folha')`](hub/server.js) |

Função: [`postLoginPath`](hub/auth.js).

## 4. Menu e permissões

O menu lateral (EJS [`hub/views/partials/hub-app-menu.ejs`](hub/views/partials/hub-app-menu.ejs) + topbar em [`hub-chrome.ejs`](hub/views/partials/hub-chrome.ejs); React [`hub-systems-menu.tsx`](NCM/fiscal/src/components/shell/hub-systems-menu.tsx) nos módulos) vem do catálogo [`hub/menu-catalog.js`](hub/menu-catalog.js). No portal EJS: sidebar fixa (~288px) com rótulo **Módulos & Sistemas** e departamentos clicáveis (Geral, Fiscal, Contábil, Folha) em accordion; **Administrativo** e **Operações & Gestão** também abrem no clique (Operações aninha Projetos e Agenda). Em Administrativo, Portal Corporativo, Gerenciar usuários e Acompanhamento Onboarding ficam no subgrupo **Configuração**. O departamento (e Configuração) da página atual já nasce aberto; abrir um departamento fecha o irmão do mesmo bloco. Item ativo com fundo verde `#006b2b` e texto branco; badges **Admin** / **Em breve**. No mobile/tablet (&lt;1024px) a sidebar vira gaveta (botão menu no topo, alvo 44px). Abaixo de 640px a Home empilha saudação e data, atalhos em várias linhas e os painéis de Comunicados, Eventos e Agenda em uma coluna; o Sair do topo fica só o ícone. Itens `soon` mostram pílula **Em breve** e vão para `/hub/modulo/:slug`. Departamento sem item visível some. `GET /api/hub/menu` inclui `icon` e `section` (`main` | `config`) em cada item.

**Quem vê o quê**

- Módulos vivos: só se o usuário tem o módulo em `hub_user_modules` (`folha`, `conci`, `ncm`).
- Portal corporativo (vídeos, POPs, diagrama, informativos, catálogos, documentos, integração): qualquer autenticado (`require: 'auth'`).
- Admin do portal (`/admin/portal`) e Gerenciar usuários: só `hub_users.is_admin`.
- Itens ainda “Em breve” (carteira, SIEG, CCT, etc.): só admin.
- Consulta BAIFER (só NCM): **Fiscal → Auditor Fiscal** (`/ncm/`). Também vê **Administrativo** (portal). Não vê GERAL, PROJETOS, AGENDA, FOLHA nem CONTÁBIL.

**Destinos**

- Auditor Fiscal → `/ncm/` (nome antigo: Auditor NCM)
- Controle DAUTO → `/folha/fiscal`
- Controle folha mensal → `/folha/dashboard`
- DAUTO Tintas → `/folha/modulos`
- Conciliação → `/conci/`
- Home / Portal → `/` (onboarding: banner + 5 cards com ícone; concluído: saudação + pills + carrossel split)
- Integração (onboarding) → `/portal/onboarding`
- Módulo da trilha (etapa) → `/portal/onboarding/etapas/:id`
- Documentos Corporativos → `/portal/documentos`
- Portal Corporativo (admin) → `/admin/portal` (grade de cards)
- Acompanhamento onboarding → `/admin/portal/onboarding/acompanhamento`
- Agenda (placeholder) → `/portal/agenda`
- Gerenciar usuários → `/admin/usuarios` (admin)
- Projetos → `/projetos` (admin): hero + três canais (Suporte de TI e Infraestrutura, Equipe de TI, Solicitação de novos módulos) e botão Abrir Portal Avadesk (https://suporte.avadesk.com.br/). Sem fila, SLA ou SSO no HUB
- Certificados Digitais → URL SIEG (`HUB_SIEG_URL` ou https://www.sieg.com.br), nova aba
- Google Agenda (menu) → `HUB_GOOGLE_CALENDAR_URL` ou https://calendar.google.com/calendar, nova aba
- Demais itens novos → `/hub/modulo/:slug` (página “Em breve”, admin)

`GET /api/hub/menu` devolve a árvore já filtrada (cookie HUB). Sem sessão → 401 JSON.

Rotas de módulo sem permissão → 403 via [`requireHubModule`](hub/middleware.js). `/projetos` e `/hub/modulo/:slug` (soon) → [`requireHubAdmin`](hub/middleware.js). Rotas `/portal/*` → [`requireHubAuth`](hub/middleware.js). `/admin/portal/*` → [`requireHubAdmin`](hub/middleware.js).

**Onboarding**

- Coluna `hub_users.onboarding_status`: `PENDING` | `IN_PROGRESS` | `COMPLETED`.
- Coluna `hub_users.department` (opcional; usada no acompanhamento admin).
- Coluna `hub_users.photo_file_id` (opcional; FK `portal_files`; foto no topbar, lista admin e `/perfil`).
- Usuário novo (não admin) nasce `PENDING`. Master EXITO e seed admin nascem `COMPLETED`.
- Quem abre `/` com status ≠ `COMPLETED` vê banner de progresso (percentual + etapas) e os **5 cards** de integração (Vídeos, POPs, Diagrama, Informativos, Catálogos).
- Quem está `COMPLETED` vê a **barra rápida** de áreas (inclui Documentos Corporativos; sem Logos) e prioriza Conteúdos Êxito, Acontece no Êxito, Agenda, Links e Contatos.
- Em `/portal/onboarding` com status `COMPLETED`: selo **Integração concluída** (sem contador `doneCount/total`), painel com barra 100% e texto “N de N etapas” quando a trilha tem etapas, botão **Ir para a Home**, grade de atalhos (Vídeos, Diagrama, POPs, Documentos) e lista das etapas em leitura (pílula Concluída; **Abrir** abre o módulo da etapa). Sem formulário de marcar etapa nem de finalizar. A exibição 100% é só visual nessa tela; o acompanhamento admin continua com o percentual real de `onboarding_user_progress`.
- Cada etapa da trilha é um **módulo**: **Abrir** vai para `GET /portal/onboarding/etapas/:id` (não para rotas genéricas como `/` ou `/portal/videos`). Colunas em `onboarding_steps`: `youtube_url` (assistir in-app, mesmo player YouTube de Vídeos), `video_download_url` (HTTPS para Baixar vídeo) e `pdf_file_id` (PDF via `/portal/media`). Sem mídia → empty “Material em preparação”. Admin cadastra em `/admin/portal/onboarding/etapas/:id/editar` (multipart). `target_kind` / `target_route` permanecem no banco (seed antigo) mas não controlam o Abrir.
- Faixa inferior da Home (pendente e concluída): painéis Comunicados/Eventos leem `portal_announcements` e `portal_events` (ativos; eventos futuros). Com linhas, lista título + data + texto/lugar; sem linhas, empty state (ícone + apoio + rodapé “Canal de transmissão interna” / “Agenda do portal”). Agenda Êxito mostra o próximo evento quando existir e CTA para `/portal/agenda`. Links em grade 2 colunas (`portal_links`); Contatos em linhas com avatar/iniciais e E-mail/WhatsApp (`portal_contacts`). Sem sync Google Agenda. Seed de demonstração (títulos com **TESTE**) em [`hub/portal/seed-demo.js`](hub/portal/seed-demo.js), uma vez por ambiente (`hub_meta.portal_demo_seed_v1`).
- Placeholders `/portal/comunicados`, `/eventos`, `/agenda` reutilizam a mesma lista ou o empty visual + CTA Voltar ao início. Textos de vazio em [`EMPTY_STATES`](hub/portal/constants.js).
- Vídeos de Integração (`portal_items` kind `video`): link YouTube obrigatório; player in-app em `/portal/videos`. O seed demo grava as 7 faixas do álbum Máquina do Tempo (canal 30PRAUM) e desativa (`is_active = false`) vídeos ativos anteriores sem apagar.
- **Progresso sequencial** (Vídeos, Diagrama, Informativos, Catálogos, Documentos): tabela `portal_item_progress` (user_id + item_id). Na área, só o 1º item (e os já liberados) ficam disponíveis; **Marcar como concluído** (`POST /portal/{slug}/:id/complete`) libera o próximo por `sort_order`. Item bloqueado não abre (`?v=` redireciona). POPs não usam esse progresso. Seed TESTE nas 4 áreas se estiverem sem itens ativos. Admin em Acompanhamento → `PENDING` apaga progresso de etapas e de itens.
- Master EXITO (`ensureMasterUser`): **não** sobrescreve `onboarding_status` no UPDATE. Reset único `hub_meta.portal_exito_onboarding_reset_v2` coloca o usuário seed / username `exito` / display EXITO em `PENDING` e limpa progressos (preview de primeiro usuário).
- `portal_items` aceita kind `document` e metadados: categoria, departamento, versão, thumbnail, obrigatório no onboarding.
- Vídeos (`kind = video`): `external_url` obrigatória e só YouTube (`youtube.com` / `youtu.be`); `/portal/videos` embute o player em destaque + grade dos demais (`?v=` para selecionar), em coluna **max 1040px** para o 16:9 não estourar no shell largo. Sem upload de MP4. Sem duração/views/capítulos inventados.
- POPs: mesmo padrão de `/portal/videos` — conteúdo **in-app** (YouTube embutido se a URL for YouTube; PDF/imagem via `/portal/media`). Sem botão “Abrir em nova aba” / link externo na visualização. Trilha com `?p=`, busca/filtro. Coluna max 1040px.
- Vídeos: player YouTube embutido; sem CTA “Abrir no YouTube” na página pública.
- Trilha padrão (8 etapas) seedada no boot em [`hub/portal/seed-onboarding.js`](hub/portal/seed-onboarding.js).
- Conteúdos Êxito (`portal_contents`): imagem recomendada **1280 × 720 px (16:9)**, JPG/PNG/WebP até 8 MB (texto no formulário admin). A Home usa carrossel split com `object-fit: cover`. No boot, [`hub/portal/seed-contents.js`](hub/portal/seed-contents.js) apaga só os slides de exemplo (títulos Bem-vindo ao Êxito, Nossa equipe, Informações internas e Novidades do Êxito, com descrição começando em “Foto de exemplo”) e o arquivo de cada um. Se a tabela ficar vazia, grava um slide com [`hub/portal/seed-assets/contents/principal.jpg`](hub/portal/seed-assets/contents/principal.jpg). Conteúdo que o admin já cadastrou permanece.
- **Não** altera `postLoginPath`: quem tem um único módulo continua indo direto ao módulo no login.

**Papéis distintos:**

- `hub_users.is_admin` — administra usuários do HUB (`/admin/usuarios`)
- Master EXITO — `is_admin` + módulos Folha/Conci/NCM + Conci `admin` + NCM `superadmin`; vê o menu inteiro e todas as empresas; login seed não pode perder esse pacote nem ser desativado
- `CONCI.users.role = 'admin'` — administra empresas/bancos Conci
- `fiscal-p.users.role = 'superadmin'` — escritório NCM (seed interno)
- `fiscal-p.users.role = 'admin'` — importa, apaga lote, exporta Excel/PDF e altera a base fiscal da empresa vinculada
- `fiscal-p.users.role = 'consulta'` — só as empresas em `user_companies` (e o `company_id` principal); vê Panorama, Consultar, Divergências e Base fiscal (leitura) da empresa **ativa**; marca já tratado; **não** vê o painel Empresas/Usuários do escritório (`/ncm/escritorio/*` redireciona ao dashboard), não lista empresas fora do vínculo, não importa, não apaga lote, não exporta Excel/PDF. Menu **Planilhas** oculto; `GET /ncm/api/export/*` → 403. Com mais de uma empresa, o seletor no topo troca o tenant da sessão (`sessions.active_company_id`), sem aceitar empresa que não esteja no vínculo.

## 5. SSO por módulo

### Conciliação

[`resolveHubSso`](CONCI/CONCI/conciliação/src/middleware/session.js) busca `CONCI.users` pelo `hub.username`. Se não existir → tela `sso-missing`.

O app está em `/conci`. Redirects do servidor ganham o prefixo em [`mountBasePath`](hub/middleware.js). Forms, `formaction`, `fetch` e `revisaoUrl` no JSON usam `u()` / `CONCI_BASE_PATH` (ex.: **Abrir** empresa = `POST /conci/admin/empresas/:id` com `action=abrir`). Links do HUB ficam sem prefixo: `/admin/usuarios`, `/logout`, home `/`. Código: [`adminEmpresas.ejs`](CONCI/CONCI/conciliação/views/adminEmpresas.ejs), [`conciliacao.js`](CONCI/CONCI/conciliação/src/routes/conciliacao.js) (`conciPath`).

### NCM

[`getUserFromHubCookie`](NCM/fiscal/src/server/hub-sso.ts) busca `fiscal-p.users` pelo `hub.email` com módulo `ncm`. Com `HUB_MODE=1`, [`getCurrentUser`](NCM/fiscal/src/server/auth.ts) usa o cookie `exito_hub_sid`; `fiscal_session` de outro e-mail é ignorada e destruída. Login e logout do HUB apagam `fiscal_session` e `fiscal_batch`. `/ncm/api/auth/me` recria a sessão NCM só se for o mesmo usuário do HUB.

## 6. Scripts de manutenção

```bash
npm run validate:login          # valida personas no banco
npm run seed:baifer-consulta     # cria/alinha login consulta só da BAIFER
npm run reconcile:modules:dry     # simula correção de módulos fantasmas
npm run reconcile:modules         # aplica correção (Conci/NCM módulo único)
cd NCM/fiscal && npm run db:migrate   # alinha o PostgreSQL fiscal-p ao Prisma (o HUB não aplica migrate no boot)
```

Produção (VPS): repo `/home/exito/projetos/EXITOHUB`, PM2 `exito-hub` na porta 3010. Depois do `git pull`: `npm ci`, migrate NCM com `NCM_DATABASE_URL` do `.env`, `pm2 restart exito-hub`. O boot garante `user_empresas` e o master EXITO.

## 7. Mapa tela → código

| Tela | Rota | Arquivo principal |
|------|------|-------------------|
| Login HUB | GET/POST `/login` | [`hub/routes.js`](hub/routes.js) |
| Home / Portal | GET `/` | [`hub/views/home.ejs`](hub/views/home.ejs) + [`hub/portal/store.js`](hub/portal/store.js) |
| Menu HUB | catálogo + `/api/hub/menu` | [`hub/menu-catalog.js`](hub/menu-catalog.js) |
| Portal — áreas | `/portal/videos` `/pops` `/diagrama` `/informativos` `/catalogos` `/documentos` | [`hub/views/portal/area.ejs`](hub/views/portal/area.ejs) |
| Portal — onboarding | `/portal/onboarding` | [`hub/views/portal/onboarding.ejs`](hub/views/portal/onboarding.ejs) |
| Portal — módulo da trilha | `/portal/onboarding/etapas/:id` | [`hub/views/portal/onboarding-step.ejs`](hub/views/portal/onboarding-step.ejs) |
| Portal — placeholders | `/portal/comunicados` `/eventos` `/agenda` | [`hub/views/portal/placeholder.ejs`](hub/views/portal/placeholder.ejs) |
| Portal — mídia | GET `/portal/media/:fileId` | [`hub/portal/upload.js`](hub/portal/upload.js) (auth; não é static) |
| Admin Portal | `/admin/portal` | [`hub/views/admin/portal-index.ejs`](hub/views/admin/portal-index.ejs) + [`hub/portal/routes.js`](hub/portal/routes.js) |
| Projetos / Avadesk | GET `/projetos` | [`hub/views/projetos.ejs`](hub/views/projetos.ejs) |
| Módulo em breve | GET `/hub/modulo/:slug` | [`hub/views/modulo-em-breve.ejs`](hub/views/modulo-em-breve.ejs) |
| Usuários HUB | `/admin/usuarios` | [`hub/views/admin-users.ejs`](hub/views/admin-users.ejs) |
| Empresas Conci | `/conci/admin/empresas` · Abrir `POST /conci/admin/empresas/:id` | [`adminEmpresas.ejs`](CONCI/CONCI/conciliação/views/adminEmpresas.ejs) |
| Pré-cadastro Conci | `/conci/pre-cadastro` | [`preCadastro.ejs`](CONCI/CONCI/conciliação/views/preCadastro.ejs) |
| Revisão Conci | `/conci/revisao/:id` | [`revisao.ejs`](CONCI/CONCI/conciliação/views/revisao.ejs) |
| Empresas NCM | `/ncm/escritorio/empresas` | NCM escritório |
| Panorama NCM | `/ncm/dashboard` | KPIs do lote com %, gráficos SVG, ranking NCM/segmento; [`kpi-dashboard.tsx`](NCM/fiscal/src/components/dashboard/kpi-dashboard.tsx) + [`GET /api/dashboard`](NCM/fiscal/app/api/dashboard/route.ts) |
| Base fiscal NCM | `/ncm/base-fiscal` | Importa regras da empresa aberta |
| Consulta NCM | `/ncm/consulta` | Grade do lote; Unica/Egaplast: **Filtrar segmento** na barra |
| Divergências NCM | `/ncm/divergencias` | Grade de divergências; Unica/Egaplast: **Filtrar segmento** na barra; exportar **Fora da base** (NCM ausente da regra) |
| Auth/me NCM | `/ncm/api/auth/me` | [`route.ts`](NCM/fiscal/app/api/auth/me/route.ts) |
| Controle DAUTO | GET `/folha/fiscal` | [`fiscal-dashboard.ejs`](BeatrizDt/views/fiscal-dashboard.ejs) |
| PDF fiscal DAUTO | GET `/folha/fiscal/pdf/:competencia` | [`fiscalPdfService.js`](BeatrizDt/services/fiscalPdfService.js) + rota em [`BeatrizDt/server.js`](BeatrizDt/server.js); attachment `Resumo_Fiscal_MM-AAAA.pdf` |
| Folha mensal | GET `/folha/dashboard` | [`dashboard.ejs`](BeatrizDt/views/dashboard.ejs) |
| PDF folha DAUTO | GET `/folha/dashboard/pdf/:competencia` | [`pdfService.js`](BeatrizDt/services/pdfService.js); attachment `Demonstrativo_Impostos_MM-AAAA.pdf` |

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

Tela **Revisão** após enviar Extrato + Contas a Pagar. Pré-cadastro por empresa+banco em `/conci/pre-cadastro`. Código: [`preCadastroStore.js`](CONCI/CONCI/conciliação/src/services/preCadastroStore.js) (`findBestPreByHistorico`, `enrichCapFromHistorico`), [`pass2.js`](CONCI/CONCI/conciliação/src/services/matching/pass2.js) (`isPagamentoGenericoSemFornecedor`), [`pass3.js`](CONCI/CONCI/conciliação/src/services/matching/pass3.js), [`mapaContas.json`](CONCI/CONCI/conciliação/src/config/mapaContas.json), [`orchestrator.js`](CONCI/CONCI/conciliação/src/services/matching/orchestrator.js), [`revisaoBulk.js`](CONCI/CONCI/conciliação/src/services/revisaoBulk.js).

A Contas a Pagar **vence**. O histórico só classifica residual (qualquer pagamento sem Classificação Êxito, não só tarifa). Não há campo extra no pré-cadastro: a descrição cadastrada é o texto (ou trecho) do histórico.

A conciliação só é gravada depois que Extrato e Contas a Pagar são lidos. Arquivo `.xlsx` ou `.xls` não passa pelo leitor de ODS. Se faltar Nome do fornecedor, CNPJ ou Valor, a tela mostra o erro e o Histórico não ganha linha nova. A conciliação pronta fica na tabela `conciliacoes`. A tela **Histórico** lê só essa tabela, da empresa aberta. Sair da revisão ou reiniciar o servidor (`pm2 restart`) não apaga o que já foi gravado. Cada Salvar/Aprovar/Rejeitar e cada ação em lote grava no banco na hora; se falhar, a tela mostra "Não foi possível salvar" e nada muda. O admin do HUB, ao entrar de novo, reabre a última empresa (`users.last_empresa_id`). O pré-cadastro fica na tabela `precadastros` (o JSON em `data/precadastro` é cópia). Backup diário: `CONCI/CONCI/conciliação/scripts/backup-conci.sh` → `/root/PROJETOS/exito/backups/conci/`. Para levar conciliações de um servidor para outro: `git pull` e `npm run migrate-conci` na raiz do HUB. Cada arquivo de `migrations/data` roda uma vez só, e um erro desfaz aquele arquivo inteiro.

| Situação | O que acontece |
|----------|----------------|
| Classificação Êxito já preenchida (Contas a Pagar ou edição) | Não sobrescreve. Débito/Crédito vêm da descrição igual no pré-cadastro |
| Classificação Êxito vazia (residual) | Procura a descrição do pré-cadastro no histórico do extrato (igualdade ou como palavra; barra `/` conta como espaço). A mais longa vence. Preenche CAP + Débito/Crédito; auto-aprova se houver códigos |
| `TAR/CUSTAS COBRANCA` (também `BB TAR/CUSTAS COBRANCA`) ou `TARIFA` / `TARIFAS` | Classificação Êxito `TARIFAS BANCARIAS`. Códigos da linha `TARIFAS BANCARIAS` do pré-cadastro. Não casa `TARIFARIO`. Não casa CAP só por valor+data |
| `ENERGIA` no pré-cadastro e histórico `NEOENERGIA` | Não classifica (evita pedaço de outra palavra) |
| Recebimento (valor positivo) | Continua CAP `RECEBIMENTO`; não classifica pelo histórico |
| Cadastrou o pré-cadastro depois do upload | **Atualizar pré-cadastro** na revisão só preenche CAP vazia. Salvar uma linha com CAP em branco também tenta o histórico |
| Extrato Itaú — histórico da revisão, relatório e TXT Domínio | Coluna Lançamento + ` - ` + Razão Social quando preenchida. Sem razão social, só o lançamento. CNPJ e razão social internos continuam para o matching. Pré-cadastro passa a procurar a descrição nesse texto maior (a CAP da planilha continua vencendo) |

## 8. Guia rápido

1. Crie empresas nos módulos Conci e NCM.
2. Em **Administrativo → Configuração → Gerenciar usuários** (`/admin/usuarios`), clique **Novo usuário**. Preencha login, e-mail, senha, foto opcional (jpeg/png/webp), marque os módulos e **marque todas as empresas** que o login pode abrir (Conciliação e/ou NCM). Salvar fecha o sheet. Para corrigir: busque o login → **Editar**. Desativar pede confirmação no rodapé. Qualquer usuário troca a própria foto em **Meu perfil** (clique no avatar/nome no topo → `/perfil`).
3. Admin Conciliação: papel **Admin Conciliação**, módulo só Conci → menu mostra **Contábil → Conciliação** (sem Folha/Auditor Fiscal). Admin do HUB vê os departamentos em accordion no menu; Projetos abre o card do Avadesk.
4. Empresa Conci: em **Pré-cadastro**, cadastre a Classificação Êxito (texto ou trecho do histórico do extrato) e os códigos Débito/Crédito. Tarifas: cadastre `TARIFAS BANCARIAS` (o extrato pode vir `TAR/CUSTAS COBRANCA`, prefixo de banco ou `TARIFA`). Essas tarifas **não** pegam CAP só por valor+data. Envie Extrato + Contas a Pagar. Na **Revisão**, o que **não** veio da planilha de CAP (nome/CNPJ) é classificado se a descrição estiver no histórico; tarifa vira `TARIFAS BANCARIAS`. Se cadastrou depois, clique **Atualizar pré-cadastro** (só preenche CAP vazia). No Itaú o histórico mostra lançamento e razão social; conciliação já salva só atualiza se reenviar o extrato.
5. Empresa NCM: e-mail + módulo NCM + empresa → `/ncm/dashboard` ao logar. No hambúrguer, o auditor aparece como **Fiscal → Auditor Fiscal**. No **Panorama**, escolha o lote; os quatro cards (Analisados, Corretos, Divergentes, Análise) mostram quantidade e %. Tratados, A tratar e Regras na base ficam na faixa abaixo. O donut é a composição do lote; as barras são os NCMs (e segmentos na Unica/Egaplast) com mais pendência — clique abre Consultar. As barras pequenas são as últimas importações (clique troca o lote). Clique num card para a lista filtrada.
6. **Consulta BAIFER (NCM):** em `/login` use `consulta.baifer` ou `consulta@baifer.local` (senha do seed, não publicada). **Não** use `baifer` — esse usuário é da Conciliação. O NCM abre direto o dashboard da BAIFER (Panorama). Vê Consultar, Divergências e Base fiscal. **Não** vê Empresas/Usuários do escritório (`/ncm/escritorio/empresas` volta ao dashboard). Não vê empresas fora do vínculo, não importa, não apaga lote, não baixa Excel/PDF. Para outro cliente consulta, o mesmo padrão: `/admin/usuarios` → NCM + empresas + papel Consulta. Com várias empresas marcadas, o seletor no topo do Auditor Fiscal troca a empresa ativa.
7. Escritório NCM: em Empresas, **Entrar** na Unica → **Base fiscal** para ver CEST, **Abrev.** e alíquotas DF/GO/MG. Pode importar a Atacadista ou `PLANILHA REGRA FISCAL UNICA.xlsx` (esta última não tem coluna Abrev.; o sistema completa pelo NCM). Importe o CSV em **Planilhas**. No **Panorama**, o card **Corretos** são os itens cuja Abreviação bate com a base (`004` = `4`). **Consulta** e **Divergências**: na barra, **Filtrar segmento** escolhe Autopeças, Tintas, Fora da base etc. (não há chips nem fila de NCM). **Divergências** mostra só o que não bateu (Abreviação diferente ou NCM fora da base). Marcar como já tratado é na **ficha** do produto. Para baixar só os NCM que **não estão na regra** da empresa: **Incluir no arquivo → Fora da base → Exportar Excel** (lote inteiro, detalhado) — só admin da empresa ou escritório. Vale também para BAIFER, Loja e Egaplast.
8. **Controle DAUTO (folha):** menu **Fiscal → Controle DAUTO** (`/folha/fiscal`). Escolha a competência (ex. 07/2026). A grade mostra **Nº Domínio**, **Empresa** e os impostos (sem Sistema Dauto nem Local). Células de imposto (admin) mostram `R$ 1.234,56` (milhar e vírgula); ao clicar, dá para editar sem o `R$`. **SC** marca SALDO CREDOR e não entra no TOTAL. **Baixar PDF** gera `Resumo_Fiscal_MM-AAAA.pdf` (cabeçalho `%PDF`). A folha mensal em **Folha de pagamento → Controle folha mensal** (`/folha/dashboard`) tem o mesmo botão (`Demonstrativo_Impostos_MM-AAAA.pdf`). Exige módulo Folha. Se o servidor não tiver Chrome do Puppeteer, a rota responde 500 em texto — não um `.pdf` falso.
9. Egaplast: em Empresas, **Entrar** na Egaplast → **Base fiscal** → Importar `TRIBUTACAO NCM EGAPLAST.xlsx` (NCM, CEST, segmento, alíquotas DF/GO/MG) e `NCM REGRA FISCAL EXITO CONTABILIDADE X EGAPLAST.xlsx` (CST+IVA SIGNATÁRIO — é a regra do escritório). As duas bases ficam juntas. Em **Planilhas**, importe o cadastro do cliente (`PLANILHA BASE DA TRIBUTAÇÃO CLIENTE EGAPLAST.xlsx`, com CÓDIGO). O arquivo EXITO SIGNATÁRIO **não** entra em Planilhas. Na ficha, **Como deve ficar** preenche o IVA da regra CST+IVA (ouro SP `1.9854` nacional / `2.1659` importado no NCM `84818019`); se a base só tiver TRIBUTACAO NCM, usa o IVA do cadastro (não deixa traço, não usa o MVA %). Cadastro sem IVA na UF = **NADA INFORMADO**. **Consulta** filtra por segmento e mostra SP. Busque pelo **código**: o mesmo NCM pode ter SKU Correto (`10100`) e Divergente (`10200`, origem 0 com IVA de importado). Linha sem SIT.TRIBUTÁRIA (`10255`) fica em **Análise** — não é erro de layout. NCM em nenhuma base e sem IVA no cadastro: o errado é o NCM — abra **Base fiscal**. O fator IVA não é comparado com o MVA % da TRIBUTACAO.

Guia expandido: [`README.md`](README.md) e [`docs/como-usar-o-sistema.md`](docs/como-usar-o-sistema.md). Detalhe do auditor: [`NCM/fiscal/README.md`](NCM/fiscal/README.md).

# Wireframes — Êxito HUB

Documento visual e funcional das telas do **Êxito HUB** (login, Home/portal, admin do portal, usuários, projetos).

**Fora deste arquivo:** Folha (`/folha`), Conciliação (`/conci`), Auditor Fiscal / NCM (`/ncm`).

Fonte de cores: [`hub/public/hub.css`](../hub/public/hub.css) (primary `#006b2b`, canvas `#e4ebf5`, cards brancos com borda `#d7e3fd`).

---

## Legenda de cores

| Elemento | Classe / token | Cor |
|----------|----------------|-----|
| Botão primário (Entrar, Salvar, Continuar) | `.hub-btn-primary` / `--exito-green` | Fundo `#006b2b`, texto branco |
| Botão primário hover | `--exito-green-hover` | `#008738` |
| Botão ghost (Cancelar, Editar, Sair, Desativar) | `.hub-btn-ghost` | Transparente / borda suave, texto escuro |
| Fundo da página (canvas) | `--hub-bg` / `--surface` | `#e4ebf5` |
| Card / painel | `--hub-card` / `--exito-card` | `#ffffff` + borda `--exito-line` (`#d7e3fd`) |
| Texto principal | `--exito-ink` / `--on-surface` | `#101c2f` |
| Texto secundário / muted | `--exito-muted` | `#536259` |
| Banner onboarding | `--exito-green-soft` | `#d6e7db` |
| Alerta sucesso | `.hub-alert-ok` | Verde suave |
| Alerta erro | `.hub-alert-error` / `--hub-danger` | `#b42318` |
| Pílula ativa / ok | `.hub-pill-ok` | Verde |
| Item do menu (página atual) | `.hub-sidebar__link.is-active` | `#006b2b` + texto branco |
| Link secundário (Abrir no YouTube) | `.hub-portal-video__open` | Texto muted (hover verde) |
| Margem do miolo | `--hub-gutter` | `1.5rem` desktop / `1rem` tablet / `0.75rem` celular |
| Vão entre blocos | `--hub-stack` | `1.25rem` |

Nos wireframes: `[ Entrar #006b2b ]` = botão primário; `[ Cancelar ghost ]` = botão ghost.

Shell padrão (todas as telas autenticadas):

```text
┌────────────┬──────────────────────────────────────────────────────┐
│ LOGO HUB   │ ☰ (mobile)  Êxito HUB / Página  [Ambiente Seguro]   │
│ sidebar    │                              🔔  Nome  [ Sair ]      │
│ grupos…    ├──────────────────────────────────────────────────────┤
│            │  conteúdo da tela                                    │
└────────────┴──────────────────────────────────────────────────────┘
```

---

## 1. Login

**Rota:** `/login`  
**Arquivo:** [`hub/views/login.ejs`](../hub/views/login.ejs)

### Wireframe

```text
┌────────────────────────────────────────┐
│              Êxito                     │
│               HUB                      │
│                                        │
│  Usuário ou e-mail                     │
│  [________________________]            │
│                                        │
│  Senha                                 │
│  [________________________]            │
│                                        │
│  [ Entrar #2ea44f ]                    │
└────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | Cor | O que faz |
|------|--------|-----|-----------|
| Entrar | `.hub-btn-primary` | `#2ea44f` | POST `/login`; cria sessão e redireciona (`postLoginPath`) |
| Alerta de erro | `.hub-alert` | vermelho / aviso | Credenciais inválidas |

### Como funciona

1. Usuário informa usuário/e-mail e senha.
2. Servidor autentica em `hub_users` e grava cookie de sessão.
3. Com **um único módulo**, vai direto ao módulo; com vários (ou nenhum), cai na Home `/`.
4. Admin e portal respeitam `is_admin` e permissões de módulo depois do login.

---

## 2. Home — integração pendente

**Rota:** `/`  
**Quando:** `onboarding_status` = `PENDING` ou `IN_PROGRESS`  
**Arquivo:** [`hub/views/home.ejs`](../hub/views/home.ejs)

### Wireframe

```text
┌────────────┬──────────────────────────────────────────────────────────────┐
│ LOGO       │ Êxito HUB / Portal Corporativo     🔔  Nome  [ Sair ]        │
│ sidebar    ├──────────────────────────────────────────────────────────────┤
│            │ ┌─ banner #d6e7db ─────────────────────────────────────────┐ │
│            │ │ ONBOARDING EM CURSO · 5 de 8 · 65%                       │ │
│            │ │ BEM-VINDO AO ÊXITO                                       │ │
│            │ │ [ Ver checklist ]  [ Continuar integração #006b2b ]      │ │
│            │ └──────────────────────────────────────────────────────────┘ │
│            │ Bom dia, Nome.                                               │
│            │ ┌ card ┐ ┌ card ┐ ┌ card ┐  (5 cards com ícone)              │
│            │ (abaixo: Conteúdos Êxito, Acontece, Agenda, Links, Contatos) │
└────────────┴──────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | Cor | O que faz |
|------|--------|-----|-----------|
| Continuar integração | `.hub-btn-primary` | `#2ea44f` | Vai para `/portal/onboarding` |
| Cards das 5 áreas | cards brancos | borda `#e5e7eb` | Abrem `/portal/videos`, `/pops`, etc. |
| Sair | `.hub-btn-ghost` | ghost | Encerra sessão |

### Como funciona

1. Quem ainda não concluiu a trilha vê o **banner** com percentual (dados de `onboarding_user_progress`).
2. Os **5 cards** de integração dominam o topo (Vídeos, POPs, Diagrama, Informativos, Catálogos).
3. O restante da Home (carrossel, comunicados, links, contatos) continua abaixo.
4. Ao concluir todas as etapas e finalizar, o status vira `COMPLETED` e a Home muda para o layout da §3.

---

## 3. Home — onboarding concluído

**Rota:** `/`  
**Quando:** `onboarding_status` = `COMPLETED`  
**Arquivo:** [`hub/views/home.ejs`](../hub/views/home.ejs) + [`hub/views/partials/hub-portal-quick-bar.ejs`](../hub/views/partials/hub-portal-quick-bar.ejs)

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ☰  ÊXITO HUB                              🔔  Nome  [ Sair ghost ]         │
├────────────────────────────────────────────────────────────────────────────┤
│ Bom dia, Nome.                                                             │
│ Tudo o que você precisa para trabalhar no Êxito.                           │
│                                                                            │
│ ÁREAS DA EMPRESA                                                           │
│ (Vídeos) (POPs) (Diagrama) (Informativos) (Catálogos) (Documentos)         │
│  ← pills brancas, borda #e5e7eb, ícone verde                               │
│                                                                            │
│ ────────────────── CONTEÚDOS ÊXITO ─────────────────────────────────────── │
│ ◀  ┌────────────────────────────┐  ▶                                       │
│    │       [ IMAGEM SLIDE ]     │                                          │
│    │ Título · descrição         │                                          │
│    └────────────────────────────┘                                          │
│         ● ○ ○   (vazio: "Em breve, novidades do Êxito.")                   │
│                                                                            │
│ ┌──────────────────────────┐ ┌──────────────────────────┐                  │
│ │ 🔔 COMUNICADOS  Ver →    │ │ 📅 EVENTOS       Ver →  │                  │
│ │   (ícone em círculo)     │ │   (ícone em círculo)    │                  │
│ │ Nenhum novo comunicado…  │ │ Nenhum evento próximo…  │                  │
│ │ texto de apoio           │ │ texto de apoio          │                  │
│ │ Canal interna      —     │ │ Agenda do portal   —    │                  │
│ └──────────────────────────┘ └──────────────────────────┘                  │
│                                                                            │
│ ┌─ [📅] AGENDA ÊXITO [Semanal] ──────────── [ Ver agenda completa ] ─────┐ │
│ │ Reuniões, treinamentos e eventos internos da semana                    │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌ LINKS ÚTEIS ─────────────┐ ┌ CONTATOS ÚTEIS [Dept ▼] ─────────────────┐ │
│ │ [icon] Nome          ↗   │ │ ○ Nome · cargo · dept                    │ │
│ │ [icon] Nome          ↗   │ │   [ E-mail ] [ WhatsApp ]                │ │
│ │ (grade 2 col; empty se   │ │ (linhas; empty se sem contatos)          │ │
│ │  sem links)              │ │                                          │ │
│ └──────────────────────────┘ └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | Cor | O que faz |
|------|--------|-----|-----------|
| Pills da barra rápida | `.hub-portal-quick__item` | pill branca + sombra + Material Symbol | Atalho para áreas do portal |
| Setas do carrossel | `.hub-carousel__nav` | botão branco/borda | Troca slide |
| Dot ativo | `.hub-carousel__dot.is-active` | `#2ea44f` | Indica slide atual |
| Painéis feed | `.hub-home-feed__panel` | branco `rounded-xl` | Empty Comunicados/Eventos |
| Agenda CTA | `.hub-home-agenda` | faixa branca + badge | Vai para `/portal/agenda` |
| Tile de link | `.hub-home-link-tile` | grade 2 col | Abre URL externa (`noopener`) |
| E-mail / WhatsApp | `.hub-home-contact__actions` | ghost | `mailto:` ou `https://wa.me/...` |

### Como funciona

1. Sem banner de integração; foco no dia a dia corporativo.
2. Barra compacta dá acesso a áreas (inclui Documentos).
3. Carrossel usa conteúdos publicados com `show_on_home`.
4. Comunicados / Eventos / Agenda são placeholders visuais Stitch (sem dados inventados; sem “sync Google”).
5. Links e contatos vêm do admin (`show_on_home` + ativos); contatos filtráveis por departamento.
6. A mesma faixa inferior aparece na Home pendente (abaixo dos 5 cards e do carrossel).

---

## 4. Menu lateral (shell)

**Arquivos:** [`hub/views/partials/hub-chrome.ejs`](../hub/views/partials/hub-chrome.ejs), [`hub/views/partials/hub-app-menu.ejs`](../hub/views/partials/hub-app-menu.ejs)

### Wireframe

```text
┌────────────────────┐
│ [logo] Êxito HUB   │
│ Portal Corporativo │
├────────────────────┤
│ Início             │
│ MÓDULOS & SISTEMAS │
│  Geral / Fiscal…   │
│ ADMINISTRATIVO     │
│  Integração        │
│  Vídeos / POPs…    │
│  Portal [Admin]    │
│ OPERAÇÕES          │
│  Projetos [Admin]  │
│  Agenda            │
├────────────────────┤
│ Versão 1.5.2       │
│ [Operacional]      │
└────────────────────┘
```

No desktop a sidebar fica fixa; abaixo de 1024px vira gaveta aberta pelo botão ☰ do topbar.

**Catálogo:** [`hub/menu-catalog.js`](../hub/menu-catalog.js)

### Cores e ações

| Ação | Cor | O que faz |
|------|-----|-----------|
| Item da página atual | fundo `#006b2b`, texto branco | Indica onde o usuário está |
| Pílula Em breve | muted | Módulo ainda não pronto → `/hub/modulo/:slug` |
| Badge Admin | muted | Só em rotas admin, para quem é admin |

### Como funciona

1. Menu filtra por auth/módulo/admin (`require` no catálogo).
2. Sidebar agrupa em Módulos & Sistemas / Administrativo / Operações & Gestão.
3. Módulos live abrem a rota real; `soon` vão para página “em breve”.
4. API `GET /api/hub/menu` devolve a árvore já filtrada.

---

## 5. Área genérica (Diagrama, Informativos, Catálogos, Documentos)

**Rotas:** `/portal/diagrama`, `/informativos`, `/catalogos`, `/documentos`  
**Arquivo:** [`hub/views/portal/area.ejs`](../hub/views/portal/area.ejs)  
**POPs:** ver §5b (layout compacto próprio).

### Wireframe

```text
┌──────────────── max ~1040px ────────────────┐
│ Início / Documentos Corporativos              │
│ ┌─ header ──────────────────────────────────┐ │
│ │ Título + descrição                        │ │
│ └───────────────────────────────────────────┘ │
│ ┌ card ┐ ┌ card ┐ ┌ card ┐  (capa limitada) │
└───────────────────────────────────────────────┘
```

### Como funciona

1. Lista só itens `is_active` do `kind` correspondente.
2. Coluna central max 1040px (`.hub-area-page`).
3. Auth obrigatória (`requireHubAuth`).

---

## 5b. POPs da Empresa (igual Vídeos de Integração)

**Rota:** `/portal/pops` · query `?p=:id`  
**Arquivo:** [`hub/views/portal/area.ejs`](../hub/views/portal/area.ejs)

### Wireframe

```text
┌──────────────── max ~1040px ────────────────┐
│ Início / POPs da Empresa                      │
│ ┌─ header ──────────────────────────────────┐ │
│ │ Abra o procedimento nesta página…         │ │
│ └───────────────────────────────────────────┘ │
│ ┌─ featured ────────────────────────────────┐ │
│ │ [POP-01] · dept / obrigatório             │ │
│ │ ┌───────────────────────────────────────┐ │ │
│ │ │  YouTube / PDF / imagem (in-app)      │ │ │
│ │ └───────────────────────────────────────┘ │ │
│ │ Título                                    │ │
│ └───────────────────────────────────────────┘ │
│ [ Buscar ] [ Dept ▼ ]                         │
│ Trilha completa · Total: N                    │
│ ┌────┐ ┌────┐ ┌────┐  ?p=id                 │
│ │P01 │ │P02 │ │víd→│                        │
│ └────┘ └────┘ └────┘                        │
└───────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | O que faz |
|------|--------|-----------|
| Viewer YouTube/PDF/img | `.hub-video-feature__player` | Assiste/lê **dentro** do HUB |
| Card da trilha | `.hub-video-playlist__card` | `?p=` troca o featured |

### Como funciona

1. Mesma hierarquia de `/portal/videos` (featured + trilha).
2. YouTube na URL → player embutido; PDF/imagem anexados → viewer in-app. Sem CTA externo na página pública.
3. Busca/dept filtram cards da trilha; featured permanece.
4. Sem “Sugerir POP” nem KPIs inventados.

---

## 6. Vídeos de Integração (player contido)

**Rota:** `/portal/videos`  
**Arquivo:** [`hub/views/portal/area.ejs`](../hub/views/portal/area.ejs) (branch `meta.slug === 'videos'`)

### Wireframe

```text
┌──────────────── max ~1040px ────────────────┐
│ Início / Vídeos de Integração                 │
│ ┌─ header ──────────────────────────────────┐ │
│ │ Assista in-app…                           │ │
│ └───────────────────────────────────────────┘ │
│ ┌─ featured ────────────────────────────────┐ │
│ │ [MOD-01] · Vídeo obrigatório / dept       │ │
│ │ ┌───────────────────────────────────────┐ │ │
│ │ │   YouTube iframe 16:9 (real)          │ │ │
│ │ └───────────────────────────────────────┘ │ │
│ │ Título                                    │ │
│ └───────────────────────────────────────────┘ │
│ Trilha completa · Total: N                    │
│ ┌────┐ ┌────┐ ┌────┐  cards compactos       │
│ │M01 │ │M02 │ │POP→│                        │
│ └────┘ └────┘ └────┘                        │
└───────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | O que faz |
|------|--------|-----------|
| Play no iframe | UI do YouTube | Assiste **dentro** do HUB |
| Módulo da playlist | `.hub-video-playlist__card` | `?v=` troca o featured |

### Como funciona

1. Admin cadastra só o **link do YouTube** (sem MP4).
2. Coluna max **1040px** + `max-height` no player evita estouro no shell largo.
3. Um player featured + playlist (não N players empilhados).
4. Sem duração, views ou capítulos inventados; sem CTA “Abrir no YouTube” na página pública.

---

## 7. Onboarding (funcionário)

**Rota:** `/portal/onboarding`  
**Arquivo:** [`hub/views/portal/onboarding.ejs`](../hub/views/portal/onboarding.ejs)

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Início / Integração                                                        │
│                                                                            │
│ Integração                                          5 / 8                  │
│ Trilha de Integração                                                       │
│ [████████████████░░░░] 65%   barra #2ea44f sobre #e8eef5                   │
│                                                                            │
│ ✓ 01 Bem-vindo...          [ Concluída pill-ok ]                           │
│ ○ 02 Conheça a empresa     [ Abrir ghost ] [ Marcar concluída #2ea44f ]    │
│ ○ 03 ...                   [ Bloqueada pill ]                              │
│ ...                                                                        │
│ ○ 08 Finalização                                                           │
│                                                                            │
│              [ Concluir integração #2ea44f ]  (disabled se incompleto)     │
└────────────────────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | Cor | O que faz |
|------|--------|-----|-----------|
| Abrir | `.hub-btn-ghost` | ghost | Vai à rota da etapa (`/portal/videos`, etc.) |
| Marcar como concluída | `.hub-btn-primary` | `#2ea44f` | POST progresso da etapa |
| Concluir integração | `.hub-btn-primary` | `#2ea44f` | Só se 100%; status → `COMPLETED` |
| Pílula concluída | `.hub-pill-ok` | verde | Etapa já feita |

### Como funciona

1. Abrir a página com `PENDING` muda para `IN_PROGRESS`.
2. Etapas desbloqueiam em sequência (a anterior precisa estar concluída).
3. “Marcar como concluída” grava em `onboarding_user_progress` (ação verificável; não mede se assistiu o vídeo até o fim).
4. “Concluir integração” exige todas as etapas ativas concluídas e redireciona à Home.

---

## 8. Placeholders — Comunicados / Eventos / Agenda

**Rotas:** `/portal/comunicados`, `/portal/eventos`, `/portal/agenda`  
**Arquivo:** [`hub/views/portal/placeholder.ejs`](../hub/views/portal/placeholder.ejs)  
**Textos:** [`EMPTY_STATES`](../hub/portal/constants.js)

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Início / Comunicados                                                       │
│ Comunicados                                                                │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │              (ícone Material em círculo)                               │ │
│ │         Nenhum novo comunicado no momento.                             │ │
│ │         texto de apoio (EMPTY_STATES.*Support)                         │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│ [ Voltar ao início  #006b2b ]                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Elemento | Classe | O que faz |
|----------|--------|-----------|
| Empty central | `.hub-home-feed__empty` | Mesmo idioma visual da Home |
| CTA | `.hub-btn-primary` | Volta para `/` |

### Como funciona

1. Empty state idêntico ao da Home; **sem dados inventados**.
2. Home aponta “Ver todos →” / “Ver agenda completa” para essas rotas.
3. Ícone por tipo: `mark_email_read` / `event_busy` / `calendar_month`.
4. Integração real (CRUD / Calendar) fica para etapa futura.

---

## 9. Admin — índice do Portal Corporativo

**Rota:** `/admin/portal`  
**Arquivo:** [`hub/views/admin/portal-index.ejs`](../hub/views/admin/portal-index.ejs)  
**Auth:** `requireHubAdmin`

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Portal Corporativo                                                         │
│ Administre os conteúdos exibidos na Home e nas áreas do portal.            │
│                                                                            │
│ [ Conteúdos Êxito ] [ Links Úteis ] [ Contatos Úteis ]                     │
│ [ Vídeos ] [ POPs ] [ Diagrama ] [ Informativos ] [ Catálogos ]            │
│ [ Documentos Corporativos ]                                                │
│ [ Onboarding — Trilha ] [ Onboarding — Acompanhamento ] [ Configurações ]  │
│  ← links de navegação (não são botões primary)                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Cor | O que faz |
|------|-----|-----------|
| Links do nav admin | texto / cards | Abre o CRUD correspondente |
| Flash ok/erro | verde / `#b42318` | Feedback pós-salvar |

### Como funciona

1. Só administradores do HUB.
2. Hub de atalhos; cada link abre listagem + formulário da seção.

---

## 10. Admin — Conteúdos Êxito (carrossel)

**Rota:** `/admin/portal/conteudos`  
**Arquivo:** [`hub/views/admin/portal-contents.ejs`](../hub/views/admin/portal-contents.ejs)

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Portal / Conteúdos Êxito                    [ + Novo conteúdo #2ea44f ]    │
│                                                                            │
│ ┌─ FORM ───────────────────────────────────────────────────────────────┐   │
│ │ Imagem *                                                             │   │
│ │ Recomendado: 1280 × 720 px (16:9). JPG/PNG/WebP, até 8 MB.           │   │
│ │ Título | Descrição | Categoria                                       │   │
│ │ Destino: nenhum / interna / externa                                  │   │
│ │ Ordem | [x] Publicado | [x] Exibir na Home                           │   │
│ │                    [ Cancelar ghost ]  [ Salvar #2ea44f ]            │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│ [thumb] Título · Publicado · data       [ Editar ghost ] [ Status ghost ]  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | Cor | O que faz |
|------|--------|-----|-----------|
| + Novo / Salvar | primary | `#2ea44f` | Cria/atualiza conteúdo (imagem obrigatória) |
| Cancelar / Editar / Status | ghost | ghost | Navega ou publica/despublica |

### Como funciona

1. Conteúdos publicados com “Exibir na Home” entram no carrossel.
2. Destino pode ser nenhum, rota `/portal/...` ou URL `https`.
3. Empty na Home: “Em breve, novidades do Êxito.”
4. Imagem recomendada: **1280 × 720 px (16:9)**, JPG/PNG/WebP até 8 MB (texto no formulário).
5. Boot remove os 4 slides de exemplo e, se `portal_contents` ficar vazio, grava o slide original (`principal.jpg`) via [`hub/portal/seed-contents.js`](../hub/portal/seed-contents.js).
---

## 11. Admin — Links Úteis

**Rota:** `/admin/portal/links`  
**Arquivo:** [`hub/views/admin/portal-links.ejs`](../hub/views/admin/portal-links.ejs)

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Portal / Links Úteis                         [ + Adicionar link #2ea44f ]  │
│                                                                            │
│ Nome | Descrição | URL https * | Categoria | Ícone | Ordem                 │
│ [x] Ativo  [x] Exibir na Home                                              │
│                    [ Cancelar ghost ]  [ Salvar #2ea44f ]                  │
│                                                                            │
│ Nome · url · [ Ativo pill-ok ]           [ Editar ghost ] [ Desativar ]    │
└────────────────────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | Cor | O que faz |
|------|--------|-----|-----------|
| Salvar / + Adicionar | primary | `#2ea44f` | Persiste link (URL só `https`) |
| Ativar / Desativar | ghost | ghost | Soft toggle `is_active` |

### Como funciona

1. Validação rejeita `javascript:` e protocolos inseguros.
2. Ativos + “Exibir na Home” aparecem na Home.
3. Clique do funcionário abre em nova aba.

---

## 12. Admin — Contatos Úteis

**Rota:** `/admin/portal/contatos`  
**Arquivo:** [`hub/views/admin/portal-contacts.ejs`](../hub/views/admin/portal-contacts.ejs)

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Portal / Contatos Úteis                   [ + Adicionar contato #2ea44f ]  │
│                                                                            │
│ Nome | Cargo | Departamento | E-mail | Telefone | WhatsApp | Descrição     │
│ Foto | Ordem | [x] Ativo | [x] Exibir na Home                              │
│                    [ Cancelar ghost ]  [ Salvar #2ea44f ]                  │
│                                                                            │
│ 👤 Nome · Cargo · Fiscal                 [ Editar ghost ] [ Desativar ]    │
└────────────────────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | Cor | O que faz |
|------|--------|-----|-----------|
| Salvar | primary | `#2ea44f` | Cria/edita contato (+ foto opcional) |
| Na Home: E-mail / WhatsApp | ghost | ghost | Contato direto |

### Como funciona

1. WhatsApp armazenado só com dígitos; Home monta `wa.me`.
2. Filtro por departamento na Home (select).
3. Soft activate/deactivate.

---

## 13. Admin — Itens (POPs, Documentos, Diagrama, etc.)

**Rota:** `/admin/portal/itens/:kind`  
**Arquivo:** [`hub/views/admin/portal-items.ejs`](../hub/views/admin/portal-items.ejs)

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Portal / POPs da Empresa                          [ + Adicionar #2ea44f ]  │
│                                                                            │
│ Título | Descrição | Categoria | Departamento | Versão | Corpo             │
│ URL externa | Arquivo | Capa/thumbnail | Ordem                             │
│ [x] Ativo  [x] Obrigatório no onboarding                                   │
│                    [ Cancelar ghost ]  [ Salvar #2ea44f ]                  │
│                                                                            │
│ [capa] Título · Fiscal · v1.2 · [ Ativo ] [ Onboarding ]                   │
│                                      [ Editar ghost ] [ Desativar ghost ]  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | Cor | O que faz |
|------|--------|-----|-----------|
| Salvar | primary | `#2ea44f` | Persiste metadados + arquivo validado |
| Desativar | ghost | ghost | Soft delete (`is_active = false`) |

### Como funciona

1. Upload valida MIME e tamanho (imagem/PDF conforme o kind).
2. Arquivos servidos só autenticados em `/portal/media/:fileId`.
3. Documentos usam `kind = document` (mesma tela).

---

## 14. Admin — Vídeos (YouTube)

**Rota:** `/admin/portal/itens/video`  
**Arquivo:** [`hub/views/admin/portal-items.ejs`](../hub/views/admin/portal-items.ejs) (branch `kind === 'video'`)

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Portal / Vídeos de Integração                     [ + Adicionar #2ea44f ]  │
│                                                                            │
│ Título | Descrição | ...                                                   │
│ Link do YouTube *   https://www.youtube.com/watch?v=...                    │
│ (sem campo de arquivo MP4)                                                 │
│ Capa/thumbnail opcional (senão usa capa do YouTube)                        │
│ [x] Ativo | [x] Obrigatório no onboarding                                  │
│                    [ Cancelar ghost ]  [ Salvar #2ea44f ]                  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | Cor | O que faz |
|------|--------|-----|-----------|
| Salvar | primary | `#2ea44f` | Valida YouTube e grava `external_url` canônica |
| Erro de URL | alerta erro | `#b42318` | Rejeita host que não seja YouTube |

### Como funciona

1. Aceita `youtube.com/watch`, `youtu.be`, `embed`, `shorts`.
2. Gera embed `youtube-nocookie.com` para `/portal/videos`.
3. Sem upload de MP4 neste fluxo.

---

## 15. Admin — Trilha de Onboarding

**Rota:** `/admin/portal/onboarding`  
**Arquivo:** [`hub/views/admin/portal-onboarding.ejs`](../hub/views/admin/portal-onboarding.ejs)

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Portal / Onboarding                    [ Acompanhamento ghost ]            │
│                                                                            │
│ Trilha de Integração                                                       │
│                                                                            │
│ 01. Bem-vindo · route → / · [ Ativa pill-ok ]                              │
│     [ ↑ ghost ] [ ↓ ghost ] [ Editar ghost ]                               │
│ 02. Conheça nossa empresa · → /portal/videos                               │
│ ...                                                                        │
│ 08. Finalização · none                                                     │
│                                                                            │
│ (form editar: Título, Descrição, Tipo, Rota, Posição, Ativa)               │
│                    [ Cancelar ghost ]  [ Salvar #2ea44f ]                  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | Cor | O que faz |
|------|--------|-----|-----------|
| Salvar etapa | primary | `#2ea44f` | Atualiza título/destino/posição |
| ↑ ↓ | ghost | ghost | Reordena etapas |
| Editar | ghost | ghost | Abre formulário da etapa |

### Como funciona

1. Trilha ativa seedada no boot (8 etapas padrão).
2. Destinos: `none`, `route`, `item`, `content`.
3. Progresso do funcionário referencia essas etapas (não apagar fisicamente se houver histórico).

---

## 16. Admin — Acompanhamento do Onboarding

**Rota:** `/admin/portal/onboarding/acompanhamento`  
**Arquivo:** [`hub/views/admin/portal-onboarding-users.ejs`](../hub/views/admin/portal-onboarding-users.ejs)

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Portal / Onboarding / Acompanhamento                                       │
│                                                                            │
│ [ Busca ]  Departamento [ Todos ▼ ]  Status [ Todos ▼ ]  [ Filtrar #2ea44f]│
│                                                                            │
│ (opcional) Detalhes — Nome                                                 │
│   01 ✓ · 02 ✓ · 03 ○ ...                                                   │
│                                                                            │
│ Funcionário   Depto    Progresso           Status      Ações               │
│ Nome          Fiscal   [████░░] 65% #2ea44f Em curso   [ Detalhes ghost ]  │
│                                            [ Marcar concluído ghost ]      │
│                                            [ Reiniciar ghost ]             │
└────────────────────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | Cor | O que faz |
|------|--------|-----|-----------|
| Filtrar | primary | `#2ea44f` | GET com `q`, `department`, `status` |
| Detalhes | ghost | ghost | Mostra etapas concluídas/pendentes |
| Marcar concluído | ghost | ghost | Força `COMPLETED` |
| Reiniciar | ghost | ghost | Volta `PENDING` e limpa progresso |

### Como funciona

1. Lista usuários do HUB com % calculado sobre a trilha ativa.
2. Status traduzidos: Pendente / Em curso / Concluído.
3. Admin pode forçar conclusão ou reinício da trilha.

---

## 17. Gerenciar usuários

**Rota:** `/admin/usuarios`  
**Arquivo:** [`hub/views/admin-users.ejs`](../hub/views/admin-users.ejs)  
**Auth:** admin

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Gerenciar usuários                              [ Novo usuário #2ea44f ]   │
│                                                                            │
│ Lista: usuário · e-mail · módulos · admin · ativo                          │
│                                      [ Editar ghost ]                      │
│                                                                            │
│ ┌─ FORM novo/editar ───────────────────────────────────────────────────┐   │
│ │ Usuário | E-mail | Nome | Senha | [x] Admin | [x] Ativo              │   │
│ │ Módulos: Folha / Conci / NCM (+ empresas quando aplicável)           │   │
│ │                    [ Cancelar ghost ]  [ Salvar #2ea44f ]            │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | Cor | O que faz |
|------|--------|-----|-----------|
| Novo / Salvar | primary | `#2ea44f` | Cria/atualiza usuário + módulos |
| Editar | ghost | ghost | Abre formulário |

### Como funciona

1. Usuário não-admin novo nasce `onboarding_status = PENDING`.
2. Admin / master EXITO nasce ou permanece `COMPLETED`.
3. Módulos provisionam acesso Folha/Conci/NCM conforme marcação.
4. Menu e Home respeitam essas permissões.

---

## 18. Projetos / Avadesk

**Rota:** `/projetos`  
**Arquivo:** [`hub/views/projetos.ejs`](../hub/views/projetos.ejs)  
**Auth:** admin

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Projetos & Chamados                                                        │
│ Projetos e Chamados (Avadesk)                                              │
│                                                                            │
│ ┌─ hero ───────────────────────────────────────────────────────────────┐   │
│ │ Plataforma homologada                                                │   │
│ │ Avadesk — Central de Suporte e Gestão de Projetos                    │   │
│ │ Chamados da Equipe de TI entram no portal Avadesk.                   │   │
│ │ [ Abrir Portal Avadesk ↗ ]                                           │   │
│ └──────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│ Diretrizes rápidas · Canais                                                │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                         │
│ │ Suporte de   │ │ Equipe de TI │ │ Solicitação  │                         │
│ │ TI e Infra   │ │ Bugs/ajustes │ │ de novos     │                         │
│ │ Rede/acesso  │ │ dos módulos  │ │ módulos      │                         │
│ │ Abrir chamado│ │ Canal no     │ │ Abrir chamado│                         │
│ │ no Avadesk   │ │ Avadesk      │ │ no Avadesk   │                         │
│ └──────────────┘ └──────────────┘ └──────────────┘                         │
└────────────────────────────────────────────────────────────────────────────┘
```

Mobile (&lt;1024px): os três cards empilham em uma coluna.

### Cores e ações

| Ação | Cor | O que faz |
|------|-----|-----------|
| Abrir Portal Avadesk | botão primary | Abre https://suporte.avadesk.com.br/ em nova aba |
| Cards de canal | card branco | Orientação fixa (sem fila/SLA no HUB) |

### Como funciona

1. Só admin vê o item no menu Projetos.
2. Não há CRUD de chamados no HUB — o CTA e os rodapés dos canais apontam ao portal Avadesk.
3. O canal do meio chama-se **Equipe de TI** (bugs, ajustes e dúvidas dos módulos).

---

## 19. Módulo em breve

**Rota:** `/hub/modulo/:slug`  
**Arquivo:** [`hub/views/modulo-em-breve.ejs`](../hub/views/modulo-em-breve.ejs)

### Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Nome do módulo                                                             │
│                                                                            │
│ Este módulo entra em uma próxima etapa. O menu já aponta para cá...        │
│ Descrição do item do catálogo.                                             │
│                                                                            │
│ [ Voltar ao início #2ea44f ]                                               │
└────────────────────────────────────────────────────────────────────────────┘
```

### Cores e ações

| Ação | Classe | Cor | O que faz |
|------|--------|-----|-----------|
| Voltar ao início | primary | `#2ea44f` | Vai para `/` |

### Como funciona

1. Itens `status: 'soon'` do menu caem aqui.
2. Centraliza expectativa: destino reservado, módulo ainda não live.
3. Slug inexistente mostra “não encontrado” + mesmo botão de voltar.

---

## Índice rápido de rotas (só Hub)

| Tela | Rota |
|------|------|
| Login | `/login` |
| Home / Portal | `/` |
| Vídeos | `/portal/videos` |
| POPs | `/portal/pops` |
| Diagrama | `/portal/diagrama` |
| Informativos | `/portal/informativos` |
| Catálogos | `/portal/catalogos` |
| Documentos | `/portal/documentos` |
| Onboarding | `/portal/onboarding` |
| Comunicados / Eventos / Agenda | `/portal/comunicados` · `/eventos` · `/agenda` |
| Admin Portal | `/admin/portal` |
| Usuários | `/admin/usuarios` |
| Projetos | `/projetos` |
| Em breve | `/hub/modulo/:slug` |

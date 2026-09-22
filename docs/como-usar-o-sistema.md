# Como usar o Êxito Hub

Guia do dia a dia. Regras oficiais: [`DOCUMENTACAO-SISTEMA.md`](../DOCUMENTACAO-SISTEMA.md).

## Entrar

1. Abra o Hub e faça login em `/login`.
2. A **sidebar** à esquerda mostra só o que o seu usuário pode acessar (no celular, use o botão de menu no topo).
3. Quem tem **vários módulos** (ou nenhum) cai na **Home** `/` — o portal corporativo.
4. Quem tem **um único módulo** (só Folha, só NCM, só Conciliação) continua indo direto para esse módulo no login. Para ver o portal, use **Início** na sidebar ou a marca Êxito HUB.

## Home / Portal corporativo

A Home muda conforme o status de integração:

**Se ainda não concluiu** (`PENDING` / `IN_PROGRESS`):

- Banner verde **Bem-vindo ao Êxito** com barra de progresso (% e etapas), **Ver checklist** e **Continuar integração**.
- **Seis cards** com ícone — Vídeos, POPs, Diagrama, Informativos, Catálogos e Logos (com contagem real de itens quando houver).
  - Em **Vídeos** (`/portal/videos`), o player YouTube fica em coluna central (~1040px) para não estourar a tela; a grade de módulos abaixo troca o vídeo ativo (`?v=`).

**Se já concluiu** (`COMPLETED`):

- Card de saudação + **atalhos rápidos** em pills (inclui Documentos Corporativos).
- Foco em Conteúdos Êxito, comunicados/eventos, agenda, links e contatos.

Em ambos os casos:

- **Conteúdos Êxito** — carrossel imagem + texto (vazio: “Em breve, novidades do Êxito.”).
- **Comunicados e Próximos eventos** — painéis com empty state (ícone + texto); **Ver todos →** abre `/portal/comunicados` ou `/portal/eventos` (mesmo empty, sem dados inventados).
- **Agenda Êxito** — faixa com badge Semanal e **Ver agenda completa** → `/portal/agenda` (placeholder; sem sync com Google Agenda).
- **Links úteis** — grade 2 colunas com os atalhos ativos do admin (vazio: empty state).
- **Contatos úteis** — linhas com foto ou iniciais; filtro por departamento; botões E-mail / WhatsApp quando cadastrados.

## Integração (onboarding)

1. Sidebar **Administrativo → Integração** ou o banner na Home.
2. Percorra as etapas (**Abrir** + **Marcar como concluída**). Etapas seguintes ficam bloqueadas até a anterior.
3. Ao terminar todas, clique **Concluir integração**.
4. A Home passa a mostrar a barra rápida (não os 6 cards grandes).

## Menu lateral

Grupos: **Módulos & Sistemas**, **Administrativo**, **Operações & Gestão**. Item da página atual fica verde. Módulo ainda não pronto aparece com a pílula **Em breve**. Itens só de admin mostram badge **Admin**.

- **Geral** — carteira, certificados (SIEG) e login do cliente (admin; a maioria ainda “Em breve”).
- **Fiscal** — Auditor Fiscal (`/ncm/`), Controle DAUTO (`/folha/fiscal`) e itens fiscais futuros (admin).
- **Contábil** — Conciliação (`/conci/`).
- **Folha de pagamento** — folha mensal, DAUTO Tintas e CCT/calculadora (admin, em breve).
- **Administrativo** — Integração, áreas do portal, **Portal Corporativo**, **Gerenciar usuários** e **Acompanhamento Onboarding** (admin).
- **Projetos (Avadesk)** — card com link para https://suporte.avadesk.com.br/ (admin).
- **Agenda** — placeholder do portal; **Google Agenda** (admin, nova aba).

Quem só tem NCM (consulta de cliente) vê **Fiscal → Auditor Fiscal** e as áreas do portal em **Administrativo**.

## Admin — Portal Corporativo

1. Login admin.
2. Sidebar **Administrativo → Portal Corporativo** (`/admin/portal`) — grade de cards.
3. Cadastre **Conteúdos Êxito**, **Links**, **Contatos**, itens por área. Em **Vídeos**, cole só o **link do YouTube**. Edite a **trilha** e acompanhe em **Acompanhamento**.
4. Links externos e YouTube devem ser `https://`. Arquivos só abrem para quem está logado.

## POPs

Na área pública (`/portal/pops`), use a busca e o filtro por departamento. Os cards são compactos (ícone, código/versão quando cadastrados, botão Visualizar). Empty state: “Nenhum procedimento encontrado”.

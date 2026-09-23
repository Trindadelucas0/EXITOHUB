# Como usar o Êxito Hub

Guia do dia a dia. Regras oficiais: [`DOCUMENTACAO-SISTEMA.md`](../DOCUMENTACAO-SISTEMA.md).

## Entrar

1. Abra o Hub e faça login em `/login`.
2. A **sidebar** à esquerda mostra só o que o seu usuário pode acessar (no celular, use o botão de menu no topo).
3. No **topo**, avatar (foto ou iniciais) e nome abrem **Meu perfil** (`/perfil`) — lá você troca só a foto (jpeg/png/webp). Login e e-mail só o admin altera em Gerenciar usuários.
4. Quem tem **vários módulos** (ou nenhum) cai na **Home** `/` — o portal corporativo.
5. Quem tem **um único módulo** (só Folha, só NCM, só Conciliação) continua indo direto para esse módulo no login. Para ver o portal, use **Início** na sidebar ou a marca Êxito HUB.

## Home / Portal corporativo

A Home muda conforme o status de integração. Layout alinhado ao mockup Stitch: coluna até ~1520px, espaçamento 1.5rem entre blocos, cards com raio 0.5rem e sombra leve.

**Se ainda não concluiu** (`PENDING` / `IN_PROGRESS`):

- Banner verde **Bem-vindo ao Êxito** com barra de progresso (% e etapas), **Ver checklist** e **Continuar integração**.
- **Cinco cards** com ícone — Vídeos, POPs, Diagrama, Informativos e Catálogos (com contagem real de itens quando houver).
  - Em **Vídeos** (`/portal/videos`), o player YouTube fica em coluna central (~1040px) para não estourar a tela; a grade de módulos abaixo troca o vídeo ativo (`?v=`).

**Se já concluiu** (`COMPLETED`):

- Card de saudação + **atalhos rápidos** em pills (inclui Documentos Corporativos; sem Logos).
- Foco em Conteúdos Êxito, comunicados/eventos, agenda, links e contatos.

Em ambos os casos:

- **Conteúdos Êxito** — carrossel imagem + texto. Na instalação nova o boot já coloca 4 fotos de exemplo; se não houver nenhum item, a Home mostra “Em breve, novidades do Êxito.”
- **Comunicados e Próximos eventos** — painéis com empty state (ícone + texto); **Ver todos →** abre `/portal/comunicados` ou `/portal/eventos` (mesmo empty, sem dados inventados).
- **Agenda Êxito** — faixa com badge Semanal e **Ver agenda completa** → `/portal/agenda` (placeholder; sem sync com Google Agenda).
- **Links úteis** — grade 2 colunas com os atalhos ativos do admin (vazio: empty state).
- **Contatos úteis** — linhas com foto ou iniciais; filtro por departamento; botões E-mail / WhatsApp quando cadastrados.

## Integração (onboarding)

1. Sidebar **Administrativo → Integração** ou o banner na Home.
2. Percorra as etapas: **Abrir** abre o **módulo** da etapa (vídeo YouTube na página, Baixar vídeo e PDF quando o admin tiver cadastrado). Depois use **Marcar como concluída**. Etapas seguintes ficam bloqueadas até a anterior.
3. Ao terminar todas, clique **Concluir integração**.
4. A Home passa a mostrar a barra rápida (não os 5 cards grandes).
5. Se voltar em **Integração** depois de concluir: vê o painel de fechamento (selo, barra completa, **Ir para a Home**), atalhos para Vídeos, Diagrama, POPs e Documentos, e a lista das etapas em leitura (revisar com **Abrir**).
6. Admin: **Portal Corporativo → Onboarding → Editar** na etapa — preenche link YouTube, link para baixar o vídeo e anexa o PDF.

## Menu lateral

Grupos: **Módulos & Sistemas**, **Administrativo**, **Operações & Gestão**. Item da página atual fica verde. Módulo ainda não pronto aparece com a pílula **Em breve**. Itens só de admin mostram badge **Admin**.

- **Geral** — carteira, certificados (SIEG) e login do cliente (admin; a maioria ainda “Em breve”).
- **Fiscal** — Auditor Fiscal (`/ncm/`), Controle DAUTO (`/folha/fiscal`) e itens fiscais futuros (admin).
- **Contábil** — Conciliação (`/conci/`).
- **Folha de pagamento** — folha mensal, DAUTO Tintas e CCT/calculadora (admin, em breve).
- **Administrativo** — Integração, áreas do portal, **Portal Corporativo**, **Gerenciar usuários** e **Acompanhamento Onboarding** (admin).
- **Projetos (Avadesk)** — página com os canais (Suporte de TI, **Equipe de TI**, novos módulos) e botão **Abrir Portal Avadesk** (https://suporte.avadesk.com.br/) (admin).
- **Agenda** — placeholder do portal; **Google Agenda** (admin, nova aba).

Quem só tem NCM (consulta de cliente) vê **Fiscal → Auditor Fiscal** e as áreas do portal em **Administrativo**.

## Admin — Portal Corporativo

1. Login admin.
2. Sidebar **Administrativo → Portal Corporativo** (`/admin/portal`) — grade de cards.
3. Cadastre **Conteúdos Êxito**, **Links**, **Contatos**, itens por área. Em **Conteúdos Êxito**, use imagem **1280 × 720 px (16:9)** — o formulário mostra essa medida. Em **Vídeos**, cole só o **link do YouTube**. Edite a **trilha** e acompanhe em **Acompanhamento**.
4. Links externos e YouTube devem ser `https://`. Arquivos só abrem para quem está logado.
5. Em **Gerenciar usuários**, no sheet criar/editar, campo **Foto de perfil** (opcional). A lista mostra a foto; o colaborador também troca em **Meu perfil**.

## POPs

Na área pública (`/portal/pops`), o conteúdo abre **dentro do HUB**: link YouTube vira player embutido; PDF/imagem anexados aparecem na página. A trilha troca o destaque (`?p=`). Não há botão para abrir fora do sistema.

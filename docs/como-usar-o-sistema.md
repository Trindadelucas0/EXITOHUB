# Como usar o Êxito Hub

Guia do dia a dia. Regras oficiais: [`DOCUMENTACAO-SISTEMA.md`](../DOCUMENTACAO-SISTEMA.md).

## Entrar

1. Abra o Hub e faça login em `/login`.
2. A **sidebar** à esquerda mostra só o que o seu usuário pode acessar (no celular, use o botão de menu no topo).
3. No **topo**, avatar (foto ou iniciais) e nome abrem **Meu perfil** (`/perfil`) — lá você troca só a foto (jpeg/png/webp). Login e e-mail só o admin altera em Gerenciar usuários.
4. Quem tem **vários módulos** (ou nenhum) cai na **Home** `/` — o portal corporativo.
5. Quem tem **um único módulo** (só Folha, só NCM, só Conciliação) continua indo direto para esse módulo no login. Para ver o portal, use **Início** na sidebar ou a marca Êxito HUB.

## Home / Portal corporativo

A Home muda conforme o status de integração. O miolo do shell fica sobre um canvas cinza-azulado (`#e4ebf5`); os cards são brancos com borda e sombra leves, com vão de 1.25rem entre blocos e margem lateral de 1.5rem no desktop (1rem no tablet, 0.75rem no celular). No monitor largo a Home ocupa a área ao lado do menu (sem coluna fixa estreita). No tablet (abaixo de 1024px) o menu vira gaveta e o carrossel empilha a foto em cima do texto. No celular (abaixo de 640px) a data fica abaixo da saudação, os atalhos quebram linha e Comunicados, Eventos e Agenda ocupam a largura da tela.

**Se ainda não concluiu** (`PENDING` / `IN_PROGRESS`):

- Banner verde **Bem-vindo ao Êxito** com barra de progresso (% e etapas), **Ver checklist** e **Continuar integração**.
- **Cinco cards** com ícone — Vídeos, POPs, Diagrama, Informativos e Catálogos (com contagem real de itens quando houver).
  - Em **Vídeos** (`/portal/videos`), o player YouTube fica em coluna central (~1040px); conclua o módulo com **Marcar como concluído** para liberar o próximo (`?v=`).
  - Em **Diagrama**, **Informativos**, **Catálogos** e **Documentos**, o próximo item só libera depois de marcar o atual como concluído. POPs continuam livremente navegáveis.

**Se já concluiu** (`COMPLETED`):

- Card de saudação + **atalhos rápidos** em pills (inclui Documentos Corporativos; sem Logos).
- Foco em Conteúdos Êxito, comunicados/eventos, agenda, links e contatos.

Em ambos os casos:

- **Conteúdos Êxito** — carrossel imagem + texto. O boot não deixa as fotos de exemplo (escritório). Se não houver conteúdo cadastrado, entra de novo a imagem original do carrossel. Sem nenhum item, a Home mostra “Em breve, novidades do Êxito.”
- **Comunicados e Próximos eventos** — listam registros ativos do banco (títulos de teste começam com **TESTE** após o seed). Sem registros, empty state. **Ver todos →** abre `/portal/comunicados` ou `/portal/eventos` com a mesma lista.
- **Agenda Êxito** — mostra o próximo evento quando houver; **Ver agenda completa** → `/portal/agenda` (mesma lista da semana; sem sync com Google Agenda).
- **Links úteis** — grade 2 colunas com os atalhos ativos do admin (vazio: empty state).
- **Contatos úteis** — linhas com foto ou iniciais; filtro por departamento; botões E-mail / WhatsApp quando cadastrados. O seed de teste preenche contatos só se a tabela estiver vazia.
- **Vídeos de Integração** — trilha com faixas de teste (Máquina do Tempo); use **Marcar como concluído** para avançar. Itens bloqueados aparecem como Bloqueado.
- **Diagrama / Informativos / Catálogos / Documentos** — mesma regra sequencial; seed grava itens TESTE se a área estiver vazia.

## Integração (onboarding)

1. Sidebar **Administrativo → Integração** ou o banner na Home.
2. Percorra as etapas: **Abrir** abre o **módulo** da etapa (vídeo YouTube na página, Baixar vídeo e PDF quando o admin tiver cadastrado). Depois use **Marcar como concluída**. Etapas seguintes ficam bloqueadas até a anterior.
3. Ao terminar todas, clique **Concluir integração**.
4. A Home passa a mostrar a barra rápida (não os 5 cards grandes).
5. Se voltar em **Integração** depois de concluir: vê o painel de fechamento (selo, barra completa, **Ir para a Home**), atalhos para Vídeos, Diagrama, POPs e Documentos, e a lista das etapas em leitura (revisar com **Abrir**).
6. Admin: **Portal Corporativo → Onboarding → Editar** na etapa — preenche link YouTube, link para baixar o vídeo e anexa o PDF.

## Menu lateral

Clique no nome do departamento (Geral, Fiscal, Contábil, Folha, Administrativo, Operações & Gestão) para abrir ou fechar os links. O departamento da página atual já vem aberto. Abrir um fecha o outro do mesmo bloco. Item da página atual fica verde. Módulo ainda não pronto aparece com a pílula **Em breve**. Itens só de admin mostram badge **Admin**.

- **Geral** — carteira, certificados (SIEG) e login do cliente (admin; a maioria ainda “Em breve”).
- **Fiscal** — Auditor Fiscal (`/ncm/`), Controle DAUTO (`/folha/fiscal`) e itens fiscais futuros (admin).
- **Contábil** — Conciliação (`/conci/`).
- **Folha de pagamento** — folha mensal, DAUTO Tintas e CCT/calculadora (admin, em breve).
- **Administrativo** — Integração, áreas do portal e, em **Configuração** (admin): Portal Corporativo, Gerenciar usuários e Acompanhamento Onboarding.
- **Operações & Gestão** — Projetos (Avadesk) e Agenda (placeholder do portal + Google Agenda para admin).

Quem só tem NCM (consulta de cliente) vê **Fiscal → Auditor Fiscal** e as áreas do portal em **Administrativo** (sem Configuração).

## Admin — Portal Corporativo

1. Login admin.
2. Sidebar **Administrativo → Configuração → Portal Corporativo** (`/admin/portal`) — grade de cards.
3. Cadastre **Conteúdos Êxito**, **Links**, **Contatos**, itens por área. Em **Conteúdos Êxito**, use imagem **1280 × 720 px (16:9)** — o formulário mostra essa medida. Em **Vídeos**, cole só o **link do YouTube**. Edite a **trilha** e acompanhe em **Acompanhamento**.
4. Links externos e YouTube devem ser `https://`. Arquivos só abrem para quem está logado.
5. Em **Gerenciar usuários**, no sheet criar/editar, campo **Foto de perfil** (opcional). A lista mostra a foto; o colaborador também troca em **Meu perfil**.

## POPs

Na área pública (`/portal/pops`), o conteúdo abre **dentro do HUB**: link YouTube vira player embutido; PDF/imagem anexados aparecem na página. A trilha troca o destaque (`?p=`). Não há botão para abrir fora do sistema.

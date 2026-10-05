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

- Banner verde **Bem-vindo ao Êxito** começa fechado, só com o título e o percentual. Clique nele para ver a barra de progresso (etapas), **Ver checklist** e **Continuar integração**; clique de novo para fechar.
- **Cinco cards** com ícone — Vídeos, POPs, Diagrama, Informativos e Catálogos (com contagem real de itens quando houver) — passam sozinhos numa faixa contínua, três por vez no computador. Pare o ponteiro em cima da faixa para ela segurar e clique em **Acessar**.
  - Em **Vídeos** (`/portal/videos`), o player YouTube fica em coluna central (~1040px); conclua o módulo com **Marcar como concluído** para liberar o próximo (`?v=`).
  - Em **Diagrama**, **Informativos**, **Catálogos** e **Documentos**, o próximo item só libera depois de marcar o atual como concluído. POPs continuam livremente navegáveis.

**Se já concluiu** (`COMPLETED`):

- Card de saudação + **Acessos principais** (só os módulos que o seu login abre: Auditor Fiscal, Conciliação, Controle folha mensal; admin vê também Portal Corporativo e Gerenciar usuários) + **atalhos rápidos** em pills (inclui Documentos Corporativos; sem Logos).
- Foco em Conteúdos Êxito, comunicados/eventos, agenda, links e contatos.

Em ambos os casos:

- **Conteúdos Êxito** — carrossel imagem + texto, só o que está **Publicado**. Com 2 ou mais publicados, troca sozinho a cada 5 s deslizando; pare o mouse em cima para segurar. Quando o conteúdo tem link, **Ver mais →** aparece no hover e o clique abre o link. O boot não deixa as fotos de exemplo (escritório). Se não houver conteúdo cadastrado, entra de novo a imagem original do carrossel. Sem nenhum item, a Home mostra “Em breve, novidades do Êxito.”
- **Comunicados** — até 4 comunicados ativos em cartões coloridos pelo tipo: **Operacional** (azul), **HUB** (verde) e **Interno** (âmbar), com selo, título, data e texto. Sem registros, empty state. **Ver todos →** abre `/portal/comunicados` (lista simples).
- **Agenda Êxito** — mostra o próximo evento quando houver; **Ver agenda completa** → `/portal/agenda` (mesma lista da semana; sem sync com Google Agenda).
- **Links úteis** — grade 2 colunas com os atalhos **ativos** do admin (vazio: empty state).
- **Contatos úteis** — linhas com foto ou iniciais, só os **ativos**; filtro por departamento; botões E-mail / WhatsApp quando cadastrados. O seed de teste preenche contatos só se a tabela estiver vazia.
- **Vídeos, POPs, Diagrama, Informativos, Catálogos e Documentos** — não aparecem como item na Home. Abra a área (`/portal/videos`, `/portal/pops` e as demais). Em Vídeos, Diagrama, Informativos, Catálogos e Documentos, o próximo item só libera depois de **Marcar como concluído**; itens bloqueados aparecem como Bloqueado. POPs continuam livremente navegáveis.

## Integração (onboarding)

1. Sidebar **Administrativo → Integração** ou o banner na Home.
2. Percorra as etapas: **Abrir** abre o **módulo** da etapa (vídeo YouTube na página, Baixar vídeo e PDF quando o admin tiver cadastrado). Depois use **Marcar como concluída**. Etapas seguintes ficam bloqueadas até a anterior.
3. Ao terminar todas, clique **Concluir integração**.
4. A Home passa a mostrar a barra rápida (não os 5 cards grandes).
5. Se voltar em **Integração** depois de concluir: vê o painel de fechamento (selo, barra completa, **Ir para a Home**), atalhos para Vídeos, Diagrama, POPs e Documentos, e a lista das etapas em leitura (revisar com **Abrir**).
6. Admin: **Portal Corporativo → Onboarding → Editar** na etapa — preenche link YouTube, link para baixar o vídeo e anexa o PDF. **Nova etapa** adiciona ao fim da trilha. Desmarque **Ativa** para tirar a etapa da trilha sem apagar; **Excluir** apaga a etapa e o progresso de quem já a concluiu (o diálogo mostra quantos).

## Menu lateral

Clique no nome do departamento (Geral, Fiscal, Contábil, Folha, Administrativo, Operações & Gestão) para abrir ou fechar os links. O departamento da página atual já vem aberto. Abrir um fecha o outro do mesmo bloco. Item da página atual fica verde. Módulo ainda não pronto aparece com a pílula **Em breve**. Itens só de admin mostram badge **Admin**.

- **Geral** — **Controle da Carteira de Clientes** (`/carteira`, admin: criar, editar e excluir a relação de empresas), certificados (SIEG) e login do cliente (admin; os dois últimos ainda “Em breve”).
- **Fiscal** — Auditor Fiscal (`/ncm/`), Controle DAUTO (`/folha/fiscal`) e itens fiscais futuros (admin).
- **Contábil** — Conciliação (`/conci/`).
- **Folha de pagamento** — folha mensal, DAUTO Tintas e CCT/calculadora (admin, em breve).
- **Administrativo** — Integração, áreas do portal e, em **Configuração** (admin): Portal Corporativo, Gerenciar usuários e Acompanhamento Onboarding.
- **Operações & Gestão** — Projetos (Avadesk) e Agenda (placeholder do portal + Google Agenda para admin).

Quem só tem NCM (consulta de cliente) vê **Fiscal → Auditor Fiscal** e as áreas do portal em **Administrativo** (sem Configuração).

## Carteira de clientes

Só admin. Sidebar **Geral → Controle da Carteira de Clientes** (`/carteira`).

1. A relação mostra **25 empresas por página**, com **Ativa** no topo da lista (depois Inativa, M e demais). Use **Anterior** e **Próxima**. Cada empresa é um **card** com espaço entre eles. No computador, cada empresa tem dois andares: o primeiro prioriza código, razão, UF, CNPJ, matriz/filial, situação, **Editar** e **Excluir**, com **uma pílula por ano** ao lado do nome (por exemplo `2026 Simples Nacional`). O segundo mostra tipo, CNAE, contato e e-mail — o regime não se repete nessa linha. Lanchonete já gravada aparece como **Comércio e Serviço**. Clique na empresa para abrir CNAE secundário, sócios e observações. No celular, o cartão traz os campos; **Regime Tributário** lista os anos, um por linha. Sem ano gravado, não há pílula.
2. Filtre por busca (código, razão ou CNPJ), situação, **ano** (padrão 2026) e regime daquele ano, ou tipo. **Regime** em Todos não esconde empresa. **Limpar** tira o filtro. **Exportar Excel** baixa **todas** as empresas desse filtro (não só as 25 da tela), com CNAE secundário, sócios, observações e **uma coluna por ano** (Regime 2026, Regime 2027 e os outros anos que existirem). Sem filtro, vêm as ~233 empresas, ativas primeiro.
3. **+ Nova empresa** abre um **modal no centro** da tela. Código e razão social são obrigatórios. Tipo da atividade: marque **Serviço**, **Comércio** e/ou **Indústria** juntos — uma lanchonete pode ser Comércio além de Serviço, e a relação já gravada foi alinhada a isso (Comércio e Serviço juntos). Em **Regime tributário**, use **Adicionar ano** para informar o ano e o regime; **Tirar** remove a linha. 2027 só aparece depois de escolhido.
4. **Editar** na linha abre o mesmo modal. **Salvar** grava; **Cancelar**, o **X**, **Esc** ou clique fora do modal fecham sem alterar.
5. **Excluir** pede confirmação. Não desfaz. Código repetido não grava; o mesmo CNPJ pode existir em dois códigos.
6. Isso não cadastra a empresa na Conciliação nem no Auditor Fiscal.

## Admin — Portal Corporativo

1. Login admin.
2. Sidebar **Administrativo → Configuração → Portal Corporativo** (`/admin/portal`). O topo resume quantos itens estão ativos em cada área; abaixo, blocos **Destaques**, **Biblioteca**, **Pessoas e avisos** e **Integração** levam a cada lista.
3. Cadastre **Conteúdos Êxito**, **Links**, **Contatos**, **Comunicados**, **Eventos** e itens por área. **Publicado** (conteúdo) e **Ativo** (link ou contato) é o que entra na Home — não há mais a opção “Exibir na Home”. Em **Conteúdos Êxito**, use imagem **1280 × 720 px (16:9)** — o formulário mostra essa medida. Em **Links**, a caixa **Como aparecerá** mostra o nome e a URL enquanto você digita. Em **Vídeos**, cole só o **link do YouTube**. A tela de cada área avisa a rota (`/portal/videos` e as demais): o item não entra na Home. Edite a **trilha** e acompanhe em **Acompanhamento**.
   - **Filtrar:** em cada lista, busque pelo texto e escolha a situação (Ativos/Inativos; em Conteúdos, Publicados/Rascunhos). Links filtram também por categoria e Contatos por setor. Depois de salvar ou excluir, a lista volta com o mesmo filtro. **Limpar** tira o filtro.
   - **Excluir:** botão **Excluir** na linha → diálogo **Excluir “nome”?** → confirmar. É definitivo. Nas áreas com trilha (Vídeos, Diagrama, Informativos, Catálogos, Documentos) e nas etapas do onboarding, se alguém já concluiu, o diálogo diz quantos colaboradores — esse progresso é apagado junto. Para só esconder, use **Desativar**.
   - **Comunicados:** título, texto, data de publicação, **Tipo** e Ativo. O Tipo (Operacional, HUB ou Interno; o novo já vem Operacional) escolhe a cor e o selo do cartão na Home. Aparecem na Home e em `/portal/comunicados` enquanto ativos.
   - **Eventos:** título, local, data/hora e Ativo. Aparecem na Home, em `/portal/eventos` e na Agenda enquanto ativos e com data futura.
   - **Vídeo em destaque:** em **Vídeos**, **Definir como destaque** marca um único vídeo (pílula **Destaque** em `/portal/videos`). Se já houver outro, a tela pergunta se deve substituir. A ordem da trilha de vídeos não muda.
4. Links externos e YouTube devem ser `https://`. Arquivos só abrem para quem está logado.
5. Em **Gerenciar usuários**, no sheet criar/editar, campo **Foto de perfil** (opcional). A lista mostra a foto; o colaborador também troca em **Meu perfil**.

## POPs

Na área pública (`/portal/pops`), o conteúdo abre **dentro do HUB**: link YouTube vira player embutido; PDF/imagem anexados aparecem na página. A trilha troca o destaque (`?p=`). Não há botão para abrir fora do sistema.

# Como usar o EXITO HUB

Guia prático do dia a dia. Comportamento detalhado: [`DOCUMENTACAO-SISTEMA.md`](../DOCUMENTACAO-SISTEMA.md) na raiz do repositório.

## Home

Após login, a Home mostra saudação, atalhos e painéis (comunicados, eventos, agenda). Quem ainda não concluiu a integração vê o banner e os cinco cards grandes da trilha.

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
- **Fiscal** — Auditor Fiscal (`/ncm/`), **Apuração Simples Nacional** (`/fiscal/apuracao-simples`, admin), Controle DAUTO (`/folha/fiscal`) e itens fiscais futuros (admin).
- **Contábil** — Conciliação (`/conci/`).
- **Folha de pagamento** — folha mensal, DAUTO Tintas e CCT/calculadora (admin, em breve).
- **Administrativo** — Integração, áreas do portal e, em **Configuração** (admin): Portal Corporativo, Gerenciar usuários e Acompanhamento Onboarding.
- **Operações & Gestão** — Projetos (Avadesk) e Agenda (placeholder do portal + Google Agenda para admin).

Quem só tem NCM (consulta de cliente) vê **Fiscal → Auditor Fiscal** e as áreas do portal em **Administrativo** (sem Configuração).

## Carteira de clientes

Só admin. Sidebar **Geral → Controle da Carteira de Clientes** (`/carteira`).

1. A relação mostra **25 empresas por página**, com **Ativa** no topo da lista (depois Inativa, M e demais). Use **Anterior** e **Próxima**. Cada empresa é um **card** com espaço entre eles. No computador, cada empresa tem dois andares: o primeiro prioriza código, razão, UF, CNPJ, matriz/filial, situação, **Editar** e **Excluir**, com **uma pílula por ano** (por exemplo `2026 Simples Nacional`) e uma **pílula de atividade** (`Serviço`, `Comércio e Serviço`, etc.) ao lado do nome. O segundo mostra CNAE, contato e e-mail — regime e tipo não se repetem nessa linha. Lanchonete já gravada aparece como **Comércio e Serviço**. Clique na empresa para abrir CNAE secundário, sócios e observações. No celular, o cartão traz os campos; **Regime Tributário** lista os anos, um por linha. Sem ano gravado, não há pílula.
2. Filtre por busca (código, razão ou CNPJ), situação, **ano** (padrão 2026) e regime daquele ano, ou tipo. No computador largo esses filtros ficam na mesma linha. No celular a barra empilha (busca, **Exportar Excel**, **Filtros**); a página não deve ampliar sozinha ao tocar na busca ou nos filtros. Quando a área útil é menor que 68rem, Situação, Ano, Regime e Tipo abrem em **Filtros** (o bloco já vem aberto se algum deles não for o padrão: Todas, 2026, Todos). **Regime** em Todos não esconde empresa. **Limpar** tira o filtro. **Exportar Excel** continua à vista, usa os campos que estão na barra na hora do clique (não precisa **Filtrar** antes) e baixa **todas** as empresas desse filtro (não só as 25 da tela), com CNAE secundário, sócios, observações e **uma coluna por ano** (Regime 2026, Regime 2027 e os outros anos que existirem). A explicação fica na dica do próprio botão. Com filtro ativo, o botão pode mostrar a quantidade `(N)`. O contador e **Anterior** / **Próxima** ficam na mesma linha. O CNPJ na relação e no arquivo sai só com os 14 números. Sem filtro, vêm as ~233 empresas, ativas primeiro.
3. **+ Nova empresa** abre um **modal no centro** da tela. Código e razão social são obrigatórios. Tipo da atividade: marque **Serviço**, **Comércio** e/ou **Indústria** juntos — uma lanchonete pode ser Comércio além de Serviço, e a relação já gravada foi alinhada a isso (Comércio e Serviço juntos). Em **Regime tributário**, use **Adicionar ano** para informar o ano e o regime; **Tirar** remove a linha. 2027 só aparece depois de escolhido.
4. **Editar** na linha abre o mesmo modal. **Salvar** grava; **Cancelar**, o **X**, **Esc** ou clique fora do modal fecham sem alterar.
5. **Excluir** pede confirmação. Não desfaz. Código repetido não grava; o mesmo CNPJ pode existir em dois códigos.
6. Isso não cadastra a empresa na Conciliação nem no Auditor Fiscal.

## Apuração Simples Nacional

Só admin. Sidebar **Fiscal → Apuração Simples Nacional** (`/fiscal/apuracao-simples`).

1. A tela é uma **grade** (não card), com todas as empresas no **Simples Nacional em 2026** na carteira. No celular, **deslize a tabela** para ver todas as colunas; a página não deve ampliar sozinha ao tocar em **Observações**.
2. Colunas **Nº**, **Nome**, **Atividade** (Comércio, Serviço, etc., igual ao card da carteira), **Regime** (uma coluna por ano), **Matriz/Filial** — só leitura, vindas da carteira.
3. **Anexos** — escolha **I**, **II**, **III**, **IV** ou **V** no seletor (um anexo por empresa). O botão **!** acima do seletor abre um card com o enquadramento da LC 123/2006 daquele anexo. Sem anexo escolhido, o card pede para selecionar. A escolha grava ao mudar o seletor.
4. **Observações** — texto só desta tela. Ao sair do campo, se mudou, grava sozinha.
5. Isso **não** altera a observação do card em **Controle da Carteira de Clientes**.

## Admin — Portal Corporativo

1. Login admin.
2. Sidebar **Administrativo → Configuração → Portal Corporativo** (`/admin/portal`). O topo resume quantos itens estão ativos em cada área; abaixo, blocos **Destaques**, **Biblioteca**, **Pessoas e avisos** e **Integração** levam a cada lista.
3. Cadastre **Conteúdos Êxito**, **Links**, **Contatos**, **Comunicados**, **Eventos** e itens por área. **Publicado** (conteúdo) e **Ativo** (link ou contato) é o que entra na Home — não há mais a opção “Exibir na Home”. Em **Conteúdos Êxito**, use imagem **1280 × 720 px (16:9)** — o formulário mostra essa medida. Em **Links**, a caixa **Como aparecerá** mostra o nome e a URL enquanto você digita. Em **Vídeos**, cole só o **link do YouTube**. A tela de cada área avisa a rota (`/portal/videos` e as demais): o item não entra na Home. Edite a **trilha** e acompanhe em **Acompanhamento**.
   - **Filtrar:** em cada lista, busque pelo texto e escolha a situação (Ativos/Inativos; em Conteúdos, Publicados/Rascunhos). Links filtram também por categoria e Contatos por setor. Depois de salvar ou excluir, a lista volta com o mesmo filtro. **Limpar** tira o filtro.
   - **Excluir:** botão **Excluir** na linha → diálogo **Excluir “nome”?** → confirmar. É definitivo. Nas áreas com trilha (Vídeos, Diagrama, Informativos, Catálogos, Documentos) e nas etapas do onboarding, se alguém já concluiu, o diálogo diz quantos colaboradores — esse progresso é apagado junto. Para só esconder, use **Desativar**.
   - **Comunicados:** título, texto, data de publicação, **Tipo** e Ativo. O Tipo (Operacional, HUB ou Interno; o novo já vem Operacional) escolhe a cor e o selo do cartão na Home. Aparecem na Home e em `/portal/comunicados` enquanto ativos.
   - **Eventos:** título, local, data/hora e Ativo. Aparecem na Home, em `/portal/eventos` e na Agenda enquanto ativos e com data futura.

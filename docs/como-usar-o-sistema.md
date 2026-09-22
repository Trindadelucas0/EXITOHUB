# Como usar o Êxito Hub

Guia do dia a dia. Regras oficiais: [`DOCUMENTACAO-SISTEMA.md`](../DOCUMENTACAO-SISTEMA.md).

## Entrar

1. Abra o Hub e faça login em `/login`.
2. O hambúrguer (☰) no canto mostra só o que o seu usuário pode acessar.
3. Quem tem **vários módulos** (ou nenhum) cai na **Home** `/` — o portal corporativo.
4. Quem tem **um único módulo** (só Folha, só NCM, só Conciliação) continua indo direto para esse módulo no login. Para ver o portal, use **Início** no topo ou a marca Êxito HUB.

## Home / Portal corporativo

A Home muda conforme o status de integração:

**Se ainda não concluiu** (`PENDING` / `IN_PROGRESS`):

- Banner **Bem-vindo ao Êxito** com barra de progresso (% e etapas) e botão **Continuar integração**.
- **Seis cards** (ilustração + nome) — Vídeos, POPs, Diagrama, Informativos, Catálogos e Logos.
  - Em **Vídeos**, o player aparece grande na página: clique em **play** e assista dentro do HUB.

**Se já concluiu** (`COMPLETED`):

- **Barra rápida** de áreas (inclui Documentos Corporativos) — atalho compacto, sem ocupar a tela.
- Foco em Conteúdos Êxito, comunicados/eventos, agenda, links e contatos.

Em ambos os casos:

- **Conteúdos Êxito** — carrossel (vazio: “Em breve, novidades do Êxito.”).
- **Comunicados, Eventos e Agenda** — placeholders (sem dados inventados).
- **Links úteis** e **Contatos úteis** (filtro por departamento; botões E-mail / WhatsApp).

## Integração (onboarding)

1. Menu **Administrativo → Integração** ou o banner na Home.
2. Percorra as etapas (Abrir conteúdo + **Marcar como concluída**).
3. Ao terminar todas, clique **Concluir integração**.
4. A Home passa a mostrar a barra rápida (não os 6 cards grandes).

## Menu por departamento

Clique no ☰. Cada departamento tem uma seta à esquerda (como o ERP); o clique abre as ferramentas com ícone. Módulo ainda não pronto aparece com a pílula **Em breve**. A página atual fica com fundo verde.

- **Geral** — carteira, certificados (SIEG) e login do cliente (admin; a maioria ainda “Em breve”).
- **Fiscal** — Auditor Fiscal (`/ncm/`), Controle DAUTO (`/folha/fiscal`: Nº Domínio + Empresa + impostos, valores em R$ com vírgula, **Baixar PDF**) e itens fiscais futuros (admin).
- **Contábil** — Conciliação (`/conci/`). Admin da Conciliação cai em **Empresas** (`/conci/admin/empresas`): **Abrir** entra na conciliação daquela empresa. Não use `/admin/empresas` sem `/conci` — isso é o HUB, não o módulo.
- **Folha de pagamento** — folha mensal, DAUTO Tintas e CCT/calculadora (admin, em breve).
- **Administrativo** — Integração, áreas do portal (vídeos, POPs, documentos, diagrama, etc.), **Portal Corporativo** (admin) e **Gerenciar usuários**.
- **Projetos** — página com o card do Avadesk. Use o portal para chamados, bugs e projetos em andamento: https://suporte.avadesk.com.br/
- **Agenda** — Google Agenda (nova aba).

Quem só tem NCM (consulta de cliente) vê **Fiscal → Auditor Fiscal** e as áreas do portal em **Administrativo**.

## Admin — Portal Corporativo

1. Login admin (ex.: EXITO).
2. Menu **Administrativo → Portal Corporativo** (`/admin/portal`).
3. Cadastre **Conteúdos Êxito**, **Links**, **Contatos**, itens por área (POPs, documentos…) com departamento/versão/capa quando fizer sentido. Em **Vídeos de Integração**, cole só o **link do YouTube** (sem enviar arquivo); o portal mostra o **player grande na página** — o funcionário assiste clicando em play no próprio HUB (não precisa abrir outra aba). Edite a **trilha de onboarding** e acompanhe funcionários em **Acompanhamento** (busca, departamento, status, detalhes de etapas).
4. Links externos e YouTube devem ser `https://`. Arquivos (imagens, PDF) só abrem para quem está logado.

## Admin — usuários

O login **EXITO** (`exito` / `escritorio@local`) é o master padrão: vê Folha, Conciliação, Auditor Fiscal, Administração e todas as empresas. Não precisa marcar empresa no cadastro.

Cadastro de pessoas do escritório e de clientes continua em **Administrativo → Gerenciar usuários** (`/admin/usuarios`). Clique **Novo usuário**. Para um acesso completo, marque **Master EXITO**. Para cliente, marque só os módulos e as empresas. Sem o módulo marcado, a ferramenta não aparece no menu.

Funcionário novo (não admin) nasce com integração **PENDING**. O master EXITO já está **COMPLETED**.

No Auditor Fiscal e na Conciliação, se o login tiver várias empresas, um seletor no topo troca a empresa ativa. O acesso continua só nas empresas marcadas no cadastro.

## Conciliação — Classificação Êxito pelo histórico

1. Em `/conci/pre-cadastro`, escolha o banco. Cadastre a descrição (o texto ou um trecho do histórico do extrato) e Débito/Crédito.
2. Tarifas bancárias: cadastre **TARIFAS BANCARIAS** com os códigos. O extrato pode mostrar `TAR/CUSTAS COBRANCA` ou `BB TAR/CUSTAS COBRANCA`.
3. Envie Extrato + Contas a Pagar. O que casar com a planilha de CAP **não** muda. O que ficar sem classificação usa o histórico contra o pré-cadastro; se houver códigos, a linha já vem aprovada.
4. Recebimentos (valor positivo) continuam **RECEBIMENTO** — não entram nessa regra.
5. Se o pré-cadastro foi feito depois do envio, na Revisão use **Atualizar pré-cadastro** (só preenche Classificação Êxito vazia).
6. Para ver de novo uma conciliação já feita, abra **Histórico** e clique **Abrir**. O botão Voltar do navegador volta para a tela Nova e não mostra os lançamentos. O administrador, ao entrar outra vez, continua na última empresa que abriu.
7. No extrato Itaú, o histórico mostra lançamento e razão social; conciliação já salva só atualiza se reenviar o extrato.

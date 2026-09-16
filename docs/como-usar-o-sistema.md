# Como usar o Êxito Hub

Guia do dia a dia. Regras oficiais: [`DOCUMENTACAO-SISTEMA.md`](../DOCUMENTACAO-SISTEMA.md).

## Entrar

1. Abra o Hub e faça login em `/login`.
2. O hambúrguer (☰) no canto mostra só o que o seu usuário pode acessar.

## Menu por departamento

Clique no ☰. Cada departamento tem uma seta à esquerda (como o ERP); o clique abre as ferramentas com ícone. Módulo ainda não pronto aparece com a pílula **Em breve**. A página atual fica com fundo verde.

- **Geral** — carteira, certificados (SIEG) e login do cliente (admin; a maioria ainda “Em breve”).
- **Fiscal** — Auditor Fiscal (`/ncm/`), Controle DAUTO (`/folha/fiscal`: Nº Domínio + Empresa + impostos, valores em R$ com vírgula, **Baixar PDF**) e itens fiscais futuros (admin).
- **Contábil** — Conciliação (`/conci/`). Admin da Conciliação cai em **Empresas** (`/conci/admin/empresas`): **Abrir** entra na conciliação daquela empresa. Não use `/admin/empresas` sem `/conci` — isso é o HUB, não o módulo.
- **Folha de pagamento** — folha mensal, DAUTO Tintas e CCT/calculadora (admin, em breve).
- **Administrativo** — POPs, informativos, organograma (em breve) e **Gerenciar usuários**.
- **Projetos** — página com o card do Avadesk. Use o portal para chamados, bugs e projetos em andamento: https://suporte.avadesk.com.br/
- **Agenda** — Google Agenda (nova aba).

Quem só tem NCM (consulta de cliente) vê **Fiscal → Auditor Fiscal**.

## Admin

O login **EXITO** (`exito` / `escritorio@local`) é o master padrão: vê Folha, Conciliação, Auditor Fiscal, Administração e todas as empresas. Não precisa marcar empresa no cadastro.

Cadastro de pessoas do escritório e de clientes continua em **Administrativo → Gerenciar usuários** (`/admin/usuarios`). Clique **Novo usuário**. Para um acesso completo, marque **Master EXITO**. Para cliente, marque só os módulos e as empresas. Sem o módulo marcado, a ferramenta não aparece no menu.

No Auditor Fiscal e na Conciliação, se o login tiver várias empresas, um seletor no topo troca a empresa ativa. O acesso continua só nas empresas marcadas no cadastro.

## Conciliação — Classificação Êxito pelo histórico

1. Em `/conci/pre-cadastro`, escolha o banco. Cadastre a descrição (o texto ou um trecho do histórico do extrato) e Débito/Crédito.
2. Tarifas bancárias: cadastre **TARIFAS BANCARIAS** com os códigos. O extrato pode mostrar `TAR/CUSTAS COBRANCA` ou `BB TAR/CUSTAS COBRANCA`.
3. Envie Extrato + Contas a Pagar. O que casar com a planilha de CAP **não** muda. O que ficar sem classificação usa o histórico contra o pré-cadastro; se houver códigos, a linha já vem aprovada.
4. Recebimentos (valor positivo) continuam **RECEBIMENTO** — não entram nessa regra.
5. Se o pré-cadastro foi feito depois do envio, na Revisão use **Atualizar pré-cadastro** (só preenche Classificação Êxito vazia).

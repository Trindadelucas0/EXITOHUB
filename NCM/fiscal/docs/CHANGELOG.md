# Changelog

## v1.3.0 — 20/08/2026

Adicionado:

- O administrador do escritório abre a conferência de qualquer empresa pelo botão “Entrar” em Empresas. A sessão guarda a empresa escolhida e o topo mostra em qual empresa ele está, com “Voltar ao escritório”.
- `POST /api/auth/select-company` e `POST /api/auth/clear-company`.

Alterado:

- Usuário agora é cadastrado só pelo escritório: a tela `/usuarios` da empresa saiu. O admin da empresa continua importando cadastro e vinculando regra, mas não cria login nem empresa.
- Rotas fiscais resolvem a empresa no servidor: usuário da empresa usa o vínculo dele, escritório usa a empresa aberta, e sem empresa aberta a resposta é `403 COMPANY_REQUIRED`.
- Panorama mostra o nome da empresa da sessão no lugar do texto fixo “BAIFER”.

Corrigido:

- O login recusava e-mail sem domínio pontuado, então o administrador do escritório (`escritorio@local`) não entrava (“Informe e-mail e senha”). O login passa a comparar o e-mail como foi cadastrado; validação de formato fica no cadastro.

Banco:

- Coluna `active_company_id` em `sessions` (FK para `companies`, com índice) e policy de sessão com `WITH CHECK` explícito.

## v1.2.0 — 19/08/2026

Adicionado:

- Administrador do escritório (`superadmin`), separado da BAIFER, com painel em `/escritorio`.
- Cadastro de empresas e de usuários de qualquer empresa só nesse painel.

Alterado:

- A tela inicial é só login (e-mail e senha). Depois do login, cada conta abre o painel cadastrado.
- Admin da empresa (BAIFER, Loja, etc.) não lista nem cria outras empresas.
- E-mail único no sistema.

Banco:

- Papel `superadmin`; `company_id` opcional em `users` e `sessions`.
- Unique em `users.email`.

## v1.1.0 — 19/08/2026

Adicionado:

- Diff automático da planilha contra o lote anterior (novos, saíram, NCM mudou, situação mudou).
- Agrupamento de divergências por NCM.
- Marca “já tratado” por produto ou por NCM, com opção de trazer as marcas na próxima importação.

Alterado:

- Importação grava o status da conferência na hora, sem reler o cadastro inteiro depois.
- Consulta pagina no servidor usando o status gravado.
- Seed atualiza regras sem apagar lotes (wipe só com `SEED_RESET_CADASTRO=1`).

Banco:

- Unique `(company_id, ncm, situacao_codigo)` nas regras.
- Colunas `treated_*` em produtos.

## v1.0.5 — 19/08/2026

Corrigido:

- Panorama, consulta e divergências passam a ter seletor de planilha e a buscar só o lote escolhido (`lote` na URL e na API). Clicar em “Ver conferência” no histórico abre os dados daquele arquivo, não da última importação.

## v1.0.4 — 19/08/2026

Alterado:

- PDF de divergências passa a ser A4 paisagem, com a grade da tela (NCM, CST, CFOP, MVA e 8 destinatários) e detalhe campo a campo.
- Excel sai em quatro abas (Resumo, Por regra, Regras, Campos), com a regra NCM por inteiro e colunas importado × regra.

## v1.0.3 — 19/08/2026

Alterado:

- Consulta, divergências, panorama e base fiscal passam a usar grade no formato da planilha (NCM, CST, CFOP, MVA e 8 destinatários), com filtros sticky.
- Matriz da ficha mostra destinatários em colunas (importado × como deve ficar).

## v1.0.2 — 19/08/2026

Alterado:

- Cada planilha importada vira um lote isolado, com histórico.
- Consulta, divergências e panorama usam só o lote escolhido.
- Importar não apaga lotes anteriores.

## v1.0.1 — 18/08/2026

Alterado:

- BAIFER usa só a primeira aba do `OK.xlsx`; Loja usa só a aba `LOJA` do ODS.
- Login exige empresa; seed e extração isolam as duas bases (`companyId`).
- Cadastro `bs.xlsx` importa só na BAIFER; Loja fica sem misturar produtos.

## v1.0.0 — 18/08/2026

Adicionado:

- Extração Python da regra fiscal e pytest das contagens/matriz.
- Next.js App Router, login, panorama, importação, base fiscal, divergências, ficha e orientação de entrada.
- Prisma/PostgreSQL com tenant, papéis admin/consulta e seed sem produtos.
- Motor de comparação (matriz CST, MVA, NCM duplicado) com Vitest.
- Export Excel/PDF.

Segurança:

- Cookie de sessão HttpOnly, rate limit no login, allowlist de upload, escape no PDF.

Banco:

- Tabelas companies, users, sessions, fiscal_ncm_rules, products, product_rule_links, import_batches.

# Changelog

## v1.6.4 — 31/08/2026

Corrigido:

- Import de `PLANILHA REGRA FISCAL UNICA.xlsx` na Base fiscal **não trazia Abrev.** porque o arquivo não tem coluna `ABREVIACAO` (só a Atacadista `Planilha3` tem). O parser passa a completar Abrev. pelo NCM da base Atacadista (`25202090` → `4`). NCM que não está nessa base continua sem Abrev.; se a coluna existir no arquivo, vale o valor da planilha.

## v1.6.3 — 31/08/2026

Corrigido:

- Conferência Unica **não** compara `Desc. Abrev. ICMS` (`000 18 0`) com a alíquota interna DF da base. Isso classificava o lote quase inteiro como **DIVERGENTE** e zerava os **Corretos**. Agora o CSV confere **Abreviação** (`004` = `4`); CEST e MVA só se o arquivo trouxer esses campos.
- `Desc. Abrev. ICMS` continua gravando só o CST. Aliq. DF na grade Unica mostra o valor da base, sem marcar vermelho por causa do `18` do ERP.

## v1.6.2 — 31/08/2026

Corrigido:

- Consulta e Divergências da Unica passam a mostrar **Abreviação**, CEST, Aliq. DF e MVA (a lista usava a grade BAIFER e a API não enviava `products.abreviacao`).
- Marcar como tratado na Unica copia Abreviação, CEST e alíquota DF da regra.
- Excel e PDF da Unica incluem Abreviação e CEST.

## v1.6.1 — 31/08/2026

Alterado:

- Conferência **Unica** (`TRIBUTACAO_UF`): compara **Abreviação fiscal** do cadastro com `abreviacao` da base; `004` e `4` são iguais; diferença → **DIVERGENTE**. BAIFER/Loja não comparam Abreviação.
- Import de CSV Unica grava a coluna `Novo Abreviação Fiscal` / `Abreviação fiscal` em `products.abreviacao` (não confundir com `Desc. Abrev. ICMS`).

## v1.6.0 — 31/08/2026

Adicionado:

- Parsers de **cadastro Egaplast** (sem criar empresa nem base fiscal):
  - listagem `.xls` (aba `Dados`: CÓDIGO, NOME, NCM; NCM `0` → vazio; ~4153 produtos);
  - relatório `.xlsx` em blocos (SIT.TRIBUTÁRIA + IVA/ICM por UF; MVA grava SP ou primeiro UF > 0; dedupe → ~1127 códigos).
- Upload de cadastro aceita `.xls` (allowlist + tela Planilhas).
- Fixtures `cadastro-egaplast-ncm-2026-08-27.xls` e `cadastro-egaplast-relatorio-produtos.xlsx` + registro em `data/calibracao/layouts.json`.

## v1.5.1 — 31/08/2026

Alterado:

- Seed Unica passa a usar a planilha **Atacadista** (`Planilha3`) como fonte oficial → `base-unica.json` com as 125 `ABREVIACAO` preenchidas (ex.: `25202090` → `4`).
- Parser: se a coluna `ABREVIACAO` não existir no arquivo, `abreviacao` fica `undefined`; no update de import, campo ausente **não apaga** abreviação já gravada.
- BAIFER e Lojão continuam sem coluna de abreviação.

## v1.5.0 — 31/08/2026

Adicionado:

- Empresa **Unica** no seed (`slug` `unica`, 125 regras) com layout de MVA/alíquota por UF (DF, GO, MG), CEST e situação `TRIBUTACAO_UF`.
- Parser de `PLANILHA REGRA FISCAL UNICA.xlsx` e da variante `TRIBUTACAO NCM UNICA ATACADISTA` (coluna `ABREVIACAO`, aba `Planilha3`).
- Grade da Base fiscal troca para colunas Unica quando a empresa tem `ufTributacao`.
- Colunas em `fiscal_ncm_rules`: `cest`, `ipi`, `abreviacao`, `reducao`, `reducao_percentual`, `uf_tributacao`.

Alterado:

- Import de regras deixa de ignorar abas `Planilha1`/`Planilha3` quando a aba tem NCM (XLSX BAIFER e Lojão).
- CFOP `5,405` (vírgula) normaliza para `5405`, como `5.405`.
- Conferência Unica não exige CST/CFOP; sem CSV de produtos fica `NECESSITA_ANALISE`.

## v1.4.0 — 26/08/2026

Adicionado:

- Planilha padrão `ncm-atualizado.ods` (fixture + `data/calibracao/layouts.json`).
- Importação de regras escolhe a aba pela empresa (`BAIFER` ou `LOJA`) e mapeia cabeçalhos curtos Santri (`Não contr`, `Contrib`, etc.).
- Normalização de CFOP (`5.405` → `5405`); na Loja, CST de saída deriva dos destinos quando a coluna não existe.

Alterado:

- Extractor Python e seed passam a usar só o ODS padrão (sem `OK.xlsx`).
- Cadastro no mesmo ODS usa a aba `Planilha_Classes_Fiscais` e ignora links/`NCM_GERAL`.

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

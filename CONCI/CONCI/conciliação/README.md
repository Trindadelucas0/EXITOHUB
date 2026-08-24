# Conciliação Bancária → Domínio

MVP local em **Node.js + Express + EJS + Tailwind** para classificar pagamentos do extrato, cruzar com Contas a Pagar, aprovar no estilo Conta Azul e exportar sempre no layout da **PLANILHA PADRAO DOMINIO.xlsx**.

## Requisitos

- Node.js 18+
- PostgreSQL local (porta 5432)

## Configuração (.env)

Copie `.env.example` para `.env` (ou use o `.env` já criado) e ajuste:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=CONCI
DB_USER=postgres
DB_PASSWORD=sua_senha
ADMIN_USER=admin
ADMIN_PASSWORD=admin123
SESSION_SECRET=change-me
PORT=3000
```

No `npm start`, o sistema:

1. Cria o banco `CONCI` se não existir
2. Cria as tabelas `empresas`, `users`, `auth_sessions` se não existirem
3. Cria o usuário admin seed se ainda não houver admin

## Como rodar

```bash
npm install
npm start
```

Abra http://localhost:3000 → redireciona para `/login`.

### Fluxo de acesso

1. Entre como **admin** (`ADMIN_USER` / `ADMIN_PASSWORD`)
2. Em `/admin/empresas`, crie uma empresa (nome + usuário + senha)
3. Saia e entre com a conta da **empresa**
4. Envie Extrato e Contas a Pagar; revise e exporte

Cada empresa tem pré-cadastro isolado em `data/precadastro/empresa-{id}.json`.

## Testes (matching / parsers)

```bash
npm test
```

Os testes de matching/pré-cadastro usam diretório temporário e **não** exigem Postgres.

## Padrão de parsers (planilhas)

Extrato e Contas a Pagar seguem o mesmo padrão:

1. Detectar cabeçalho por sinônimos (sem índices fixos)
2. Mapear colunas dinamicamente
3. Em Contas a Pagar Santri: carregar categoria de linhas de grupo (`BOLETOS`, `FORNECEDORES`…)
4. Validar cada linha com várias regras/regex antes de aceitar
5. Sem dados úteis → erro claro com os cabeçalhos encontrados

## Extrato multi-layout + Gemini (modo conservador)

No upload, com `GEMINI_API_KEY` no `.env`:

1. Barra de progresso por etapas
2. Gemini sugere colunas do extrato (amostra pequena)
3. Validação por regras/regex (Data, Histórico, Valor)
4. Se a planilha não tiver dados utilizáveis, o processo **para com aviso**

Proteção de cota (conta nova / free tier):

- `GEMINI_MAX_CONCURRENT=1` — nunca paralelo
- `GEMINI_MIN_INTERVAL_MS=12000` — pelo menos 12s entre chamadas
- `GEMINI_MAX_CALLS_PER_HOUR=8` — teto local; acima disso usa fallback por nomes
- `GEMINI_RETRY_MAX=1` — não martela a API em caso de erro
- Sem retry quando a cota já está zerada

### Como criar a chave Gemini

1. https://aistudio.google.com/apikey
2. **Create API key** → cole em `GEMINI_API_KEY` no `.env` (nunca no chat/git)
3. Reinicie `npm start`

Enquanto a IA falhar ou bater o teto horário, o sistema usa **fallback** por nomes de coluna.


Débito/Crédito vêm **só do pré-cadastro** da empresa logada.

Em http://localhost:3000/pre-cadastro:

- Pagamentos: descrição = Classificação Êxito (ex.: `ENERGIA`)
- Tarifas: `TARIFAS BANCARIAS`
- Recebimentos: padrão CAP = `RECEBIMENTO` (códigos via `RECEBIMENTO DE CLIENTES`); CAP editável na revisão busca Débito/Crédito pela descrição digitada

## Filtros na revisão

Acima da tabela há campos para filtrar por Data, Débito, Crédito, Valor, Histórico, Nº nota e Classificação Êxito.

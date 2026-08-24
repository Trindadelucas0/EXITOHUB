# API

Autenticação: cookie `fiscal_session` (HttpOnly, SameSite=Lax, Secure em produção).  
Todas as rotas de negócio exigem sessão válida. Rotas fiscais exigem uma empresa resolvida no servidor: o usuário da empresa usa o `companyId` dele; o escritório usa a empresa que abriu (`POST /api/auth/select-company`) e sem isso recebe `403 COMPANY_REQUIRED`. Mutações de importação/vínculo exigem `admin` da empresa ou o escritório dentro dela. Marcar “já tratado” vale para admin e consulta.  
Respostas: `{ success, data }` ou `{ success: false, error: { code, message } }`.

| Método | Rota | Auth | Função |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | pública + rate limit | autentica (e-mail e senha); devolve `redirectTo` |
| POST | `/api/auth/logout` | sessão | encerra cookie |
| GET | `/api/auth/me` | sessão | usuário, empresa efetiva, `fromOffice` e `canWrite` |
| POST | `/api/auth/select-company` | superadmin | abre a empresa (`companyId`) na sessão do escritório |
| POST | `/api/auth/clear-company` | superadmin | fecha a empresa e volta ao painel do escritório |
| GET | `/api/dashboard` | sessão | totais do lote ativo (`lote`) |
| GET | `/api/rules` | sessão | lista NCM (`q`, `situacao`) |
| GET | `/api/rules/:id` | sessão | regra; outro tenant → 404 |
| GET | `/api/products` | sessão | cadastro do lote (`q`, `ncm`, `status`, `lote`, `page`, `pageSize`, `tratado=nao\|sim`); summary e página |
| GET | `/api/products/ncm-summary` | sessão | agrupamento por NCM do lote (`status`, `tratado`) |
| GET | `/api/products/:id` | sessão | ficha + matriz + guia de entrada + tratado |
| POST | `/api/products/:id` | admin | vincula regra quando NCM é duplo |
| POST | `/api/products/:id/treated` | sessão | marca/desmarca já tratado |
| POST | `/api/products/treated-ncm` | sessão | marca/desmarca todos os produtos do NCM no lote |
| GET | `/api/import` | sessão | histórico de lotes + `activeBatchId` |
| POST | `/api/import` | admin | cria um lote novo com `auditStatus` gravado; `manterTratados=1\|0` |
| GET | `/api/import/diff` | sessão | diff vs lote anterior (`lote`, `tipo`, `page`) |
| POST | `/api/import/select` | sessão | escolhe o lote ativo (cookie HttpOnly) |
| DELETE | `/api/import/:id` | admin | apaga um lote; outro tenant → 404; regras NCM intactas |
| GET | `/api/export/excel` | sessão | Excel; `status=DIVERGENTE\|CORRETO\|NECESSITA_ANALISE` (vazio = todos); `somente=divergentes\|corretos\|analise\|todos` (legado); `tratado=nao` oculta já tratados |
| GET | `/api/export/pdf` | sessão da empresa | PDF A4 paisagem; mesmos filtros; texto escapado |
| GET | `/api/companies` | superadmin | lista empresas |
| POST | `/api/companies` | superadmin | cria empresa e o primeiro admin |
| GET | `/api/users` | superadmin | lista usuários da empresa (`companyId` obrigatório) |
| POST | `/api/users` | superadmin | cria usuário (`companyId` obrigatório; papel só `admin` ou `consulta`) |

Login inválido: `401` sem distinguir se o e-mail existe.  
Sem permissão: `403`.  
Recurso de outra empresa: `404`.

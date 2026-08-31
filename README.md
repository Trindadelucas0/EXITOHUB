# EXITO HUB

Um servidor para Folha (BeatrizDt), Conciliação e Auditor NCM.

## Subir

```bash
# Na raiz (novo - exito)
npm install
npm run dev
```

Abra http://localhost:3000

Login inicial (seed via `.env`):

- usuário: valor de `HUB_SEED_ADMIN_USER`
- senha: valor de `HUB_SEED_ADMIN_PASSWORD`

## Rotas

| Caminho | Módulo |
|---------|--------|
| `/` | Home do HUB |
| `/login` | Login único (usuário ou e-mail) |
| `/admin/usuarios` | **Cadastro único de usuários** + permissões |
| `/folha` | Folha & Fiscal |
| `/conci` | Conciliação |
| `/ncm` | Auditor NCM |

Documentação completa: [`DOCUMENTACAO-SISTEMA.md`](DOCUMENTACAO-SISTEMA.md)

## Bancos (separados)

- `exito_hub` — usuários do HUB
- `beatriz_impostos` — Folha
- `CONCI` — Conciliação
- `fiscal-p` — NCM

## Login único — cadastro centralizado no HUB

1. **Empresa** → cadastre em `/conci/admin/empresas` ou `/ncm/escritorio/empresas` (só nome/dados da empresa).
2. **Usuário** → cadastre em `/admin/usuarios`: marque módulo(s), escolha empresa Conci/NCM e papel.
3. **Login** → `/login` com usuário (Conci/Folha) ou e-mail (NCM) + senha do HUB.

O HUB provisiona Conciliação e NCM automaticamente. O menu e as rotas só mostram o que está em `hub_user_modules`.

| Persona | O que digita no `/login` | Para onde vai | Menu |
|---------|--------------------------|---------------|------|
| Admin Conciliação | username | `/conci/admin/empresas` | só Conci |
| Empresa Conci | username | `/conci/` da empresa | só Conci |
| Empresa NCM | e-mail | `/ncm/dashboard` | só NCM |
| Só Folha | usuário | `/folha/modulos` | só Folha |
| Admin HUB (2+ módulos) | usuário ou e-mail | Home `/` | módulos marcados |

### Folha

Sem tela de usuários no módulo. Marque **Folha** em `/admin/usuarios`. Admin Folha = checkbox **Admin HUB**.

### Conciliação

Empresas em `/conci/admin/empresas`. Usuários **somente** em `/admin/usuarios` (módulo Conciliação + empresa + papel).

### NCM

Empresas em `/ncm/escritorio/empresas`. Usuários **somente** em `/admin/usuarios` (módulo NCM + empresa + papel). Tela `/ncm/escritorio/usuarios` é consulta.

### Checklist manual

1. Admin Conciliação: login → `/conci/admin/empresas`; menu **sem** Folha/NCM; `/folha` e `/ncm` → 403.
2. Empresa Conci: login → conciliação da empresa; menu só Conci.
3. Empresa NCM: login com e-mail → dashboard; menu só NCM.
4. Criar usuário novo só pelo HUB e confirmar acesso no módulo sem cadastro manual no Conci/NCM.

### Validação e reconciliação

```bash
npm run validate:login
npm run reconcile:modules:dry   # ver o que seria corrigido
npm run reconcile:modules       # remove módulos fantasmas (ex.: admin Conci com NCM)
```

Copia `.env.example` para `.env` e ajuste as senhas.

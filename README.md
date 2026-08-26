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
| `/admin/usuarios` | Cadastro HUB / Folha e permissões |
| `/folha` | Folha & Fiscal |
| `/conci` | Conciliação |
| `/ncm` | Auditor NCM |

## Bancos (separados)

- `exito_hub` — usuários do HUB
- `beatriz_impostos` — Folha
- `CONCI` — Conciliação
- `fiscal-p` — NCM

## Login único (mesmo contrato nos três)

O ponto de acesso é só `/login`. Cadastro no sistema de origem; a senha é a do HUB; o destino segue **onde a pessoa foi criada**. O menu e as rotas só mostram/liberam o que o HUB marcou — usuário de empresa **não** vê Folha/Conci/NCM além do próprio sistema.

| Onde cadastrou | O que digita no `/login` | Para onde vai | Menu |
|----------------|--------------------------|---------------|------|
| HUB `/admin/usuarios` só com Folha | usuário + senha | `/folha/modulos` | só Folha |
| Conciliação → Nova empresa | usuário + senha da empresa | `/conci/` daquela empresa | só Conci |
| NCM → Empresas / Usuários | e-mail + senha | `/ncm/dashboard` daquela empresa | só NCM |
| HUB com 2+ módulos (ex.: admin) | usuário + senha | Home do HUB | módulos marcados |

### Folha

Não tem tela de usuários dentro do módulo. Criar usuário Folha = `/admin/usuarios` com o checkbox **Folha**.

### Conciliação

Em `/conci/admin/empresas`, usuário e senha da empresa são o login do HUB. Ao entrar, a pessoa cai na conciliação daquela empresa (sem segunda senha).

### NCM

Em `/ncm/escritorio/empresas` (ou Usuários), e-mail e senha são o login do HUB. Ao entrar, a pessoa cai no NCM daquela empresa. O escritório (vários módulos) abre empresas pela lista **Entrar**.

Ao cadastrar no NCM ou na Conciliação, o HUB recebe a mesma senha automaticamente. Usuários que já existiam nesses bancos são importados na subida do servidor.

### Checklist manual

1. Empresa NCM (ex. BAIFER): `/login` com e-mail → dashboard da empresa; menu **sem** Folha/Conci; `/folha` ou `/conci` → 403.
2. Empresa Conci: `/login` com username → conciliação da empresa; menu sem Folha/NCM.
3. HUB só Folha: `/login` → `/folha/modulos`; menu sem Conci/NCM.
4. Admin HUB (3 módulos): home + menu completo; no NCM precisa **Entrar** na empresa.

### Validação no banco

```bash
npm run validate:login
```

Copia `.env.example` para `.env` e ajuste as senhas.

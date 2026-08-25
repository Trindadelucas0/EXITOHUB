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
| `/admin/usuarios` | Permissões de módulo |
| `/folha` | Folha & Fiscal |
| `/conci` | Conciliação |
| `/ncm` | Auditor NCM |

## Bancos (separados)

- `exito_hub` — usuários do HUB
- `beatriz_impostos` — Folha
- `CONCI` — Conciliação
- `fiscal-p` — NCM

## Login único

O ponto de acesso é só `/login`. O destino segue **onde a pessoa foi cadastrada**:

- Criou no HUB só com Folha → entra em `/folha/modulos`
- Criou empresa na Conciliação → entra em `/conci/`
- Criou usuário/empresa no NCM (e-mail) → entra direto no NCM **daquela empresa** (`/ncm/dashboard`)
- Mais de um módulo (ex.: admin do escritório) → home do HUB para escolher

Ao cadastrar no NCM ou na Conciliação, o HUB recebe a mesma senha automaticamente. Usuários que já existiam nesses bancos são importados na subida do servidor.

No NCM, **Entrar** numa empresa (ex.: BAIFER) abre a conferência dela sem segundo login.

Copie `.env.example` para `.env` e ajuste as senhas.

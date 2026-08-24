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
| `/login` | Login único |
| `/admin/usuarios` | Permissões de módulo |
| `/folha` | Folha & Fiscal |
| `/conci` | Conciliação |
| `/ncm` | Auditor NCM |

## Bancos (separados)

- `exito_hub` — usuários do HUB
- `beatriz_impostos` — Folha
- `CONCI` — Conciliação
- `fiscal-p` — NCM

## SSO

- Folha: usa o usuário do HUB (admin do HUB → admin da Folha)
- Conciliação: mesmo **username** precisa existir no banco CONCI
- NCM: mesmo **e-mail** precisa existir no banco fiscal-p

Copie `.env.example` para `.env` e ajuste as senhas.

# Auditor Fiscal

Sistema web para o escritório conferir o cadastro importado contra a **base fiscal da empresa ativa**.

**Planilha padrão BAIFER/Loja:** `data/ncm-atualizado.ods` (fixture em `tests/fixtures/ncm-atualizado.ods`).

| Aba / arquivo | Uso |
| --- | --- |
| `BAIFER` (ODS) ou XLSX `TRIBUTACAO NCM BAIFER` (`Planilha1`) | Base fiscal da BAIFER |
| `LOJA` (ODS) ou XLSX Lojão (`Planilha1`) | Base fiscal da Loja das Máquinas |
| Atacadista Unica (`Planilha3`, com `ABREVIACAO`) | Base fiscal oficial da Unica no seed (CEST + Abrev. + MVA/alíquota DF·GO·MG) |
| `PLANILHA REGRA FISCAL UNICA.xlsx` | Variante sem coluna `ABREVIACAO` — import no update não apaga Abrev. já gravada |
| `Planilha_Classes_Fiscais` | Cadastro Santri (tela **Planilhas**) — não vira base fiscal |
| `NCM_GERAL` / links | Ignoradas |

As bases **não se misturam** (`companyId` em toda query). Em **Base fiscal → Importar regras**, o layout segue a empresa da sessão.

1. Extraia as regras do ODS padrão (BAIFER/Loja) e da Unica:

```bash
python tools/extract_rules.py
npx tsx prisma/extract-unica.ts
pytest
```

2. Instale e prepare o banco:

```bash
npm install
npm run db:init
npx prisma migrate deploy
npm run db:seed
npm test
npm run dev
```

3. Abra `http://localhost:3000` (ou o HUB) e entre só com e-mail e senha:

- Escritório: `SEED_SUPERADMIN_EMAIL` — cai no painel das empresas; cadastra empresa/usuário e usa “Entrar” para abrir a conferência de uma empresa
- BAIFER: `admin@baifer.local` — abre direto a conferência da BAIFER
- Loja: `admin@loja.local` — abre direto a conferência da Loja
- Unica (seed local): `admin@unica.local` — base fiscal Unica. No HUB, o login da equipe é criado em `/admin/usuarios`

Senha das empresas: `SEED_ADMIN_PASSWORD`. Senha do escritório: `SEED_SUPERADMIN_PASSWORD`. O seed **não apaga** planilhas já importadas. Para zerar só o cadastro: `SEED_RESET_CADASTRO=1 npm run db:seed`.

4. Cadastro do cliente (export Santri, CSV Unica ou a aba `Planilha_Classes_Fiscais` do ODS) importa **um lote por arquivo** na empresa logada. Lotes anteriores ficam no histórico:

```bash
npm run import:cadastro
```

## O que o MVP responde

1. O cadastro está coerente com a matriz NCM (BAIFER/Loja) ou com CEST/alíquota/MVA (Unica, quando o CSV de produtos existir)?
2. Onde diverge (destinatário a destinatário, ou CEST/alíquota Unica)?
3. Como dar entrada — só com o que existe na regra (CST entrada, CST BAIFER, CFOP de saída, MVA). Na Unica a conferência de cadastro fica limitada até o CSV de itens.

## Regras da aba BAIFER

| Padrão | O que a base diz |
| --- | --- |
| Regra geral | Entrada 0, CST BAIFER 0, CFOP 5102, CST 0 nos 8 destinos |
| ST interno | Entrada 0, CST 10, CFOP 5403; 0 para não contrib/construt/hosp/órgão/rural; 10 para contrib/revenda/atacado |
| ST nacional | CST 60 em todos, CFOP 5405; a entrada costuma ser 10 |
| Redução | Entrada 20, CST 20, CFOP 5102; na base só Atacado costuma vir preenchido — a conferência completa os demais com o CST de saída |
| Incompleta | CST/CFOP vazios → necessita análise |
| Tributação por UF | Unica: NCM + CEST + Abrev. (Atacadista) + MVA/alíquota DF, GO, MG (sem matriz de 8 destinos; BAIFER/Lojão sem Abrev.) |
| NCM com duas regras | Amarelo até vincular |
| NCM mascarado | `82032010-2` e `82.03.20.10` → `82032010` |

**Fonte BAIFER/Loja:** `ncm-atualizado.ods`. **Fonte Unica (seed):** `tests/fixtures/tributacao-ncm-unica-atacadista-2026-08-27.xlsx` (`Planilha3`) → `data/base-unica.json` (125 regras com `ABREVIACAO`). Layout calibrado em `data/calibracao/layouts.json`.

## Testes

- `pytest` — contagens e matriz `32141010` no ODS
- `npm test` — motor TS, auth/tenant, import do ODS, XLSX BAIFER/Lojão/Unica, escape de PDF

## Documentação

- [Para o dono](docs/PARA-O-DONO.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Banco](docs/DATABASE.md)
- [Segurança](docs/SECURITY.md)
- [Deploy](docs/DEPLOY.md)
- [Changelog](docs/CHANGELOG.md)

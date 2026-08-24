# Auditor Fiscal BAIFER

Sistema web para o escritório conferir o cadastro importado contra a **base fiscal da empresa ativa**.

- **BAIFER:** regras da primeira aba do `OK.xlsx`
- **Loja das Máquinas:** regras da aba **LOJA** do ODS
- As duas bases **não se misturam** (`companyId` em toda query)

1. Extraia as regras (BAIFER do `OK.xlsx`, Loja da aba `LOJA` do ODS):

```bash
python tools/extract_rules.py
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

3. Abra `http://localhost:3000` e entre só com e-mail e senha:

- Escritório: `SEED_SUPERADMIN_EMAIL` — cai no painel das empresas; cadastra empresa/usuário e usa “Entrar” para abrir a conferência de uma empresa
- BAIFER: `admin@baifer.local` — abre direto a conferência da BAIFER
- Loja: `admin@loja.local` — abre direto a conferência da Loja

Senha das empresas: `SEED_ADMIN_PASSWORD`. Senha do escritório: `SEED_SUPERADMIN_PASSWORD`. O seed **não apaga** planilhas já importadas. Para zerar só o cadastro: `SEED_RESET_CADASTRO=1 npm run db:seed`.

4. Cadastro do cliente (export Santri) importa **um lote por arquivo** na empresa logada. Lotes anteriores ficam no histórico:

```bash
npm run import:cadastro
```

## O que o MVP responde

1. O cadastro está coerente com a matriz NCM?
2. Onde diverge (destinatário a destinatário)?
3. Como dar entrada — só com o que existe na regra (CST entrada, CST BAIFER, CFOP de saída, MVA).

## Regras da aba BAIFER

| Padrão | O que a base diz |
| --- | --- |
| Regra geral | Entrada 0, CST BAIFER 0, CFOP 5102, CST 0 nos 8 destinos |
| ST interno | Entrada 0, CST 10, CFOP 5403; 0 para não contrib/construt/hosp/órgão/rural; 10 para contrib/revenda/atacado |
| ST nacional | CST 60 em todos, CFOP 5405; no `OK.xlsx` a entrada costuma ser 10 |
| Redução | Entrada 20, CST 20, CFOP 5102; só Atacado preenchido |
| Incompleta | CST/CFOP vazios → necessita análise |
| NCM com duas regras | Amarelo até vincular |
| NCM mascarado | `82032010-2` e `82.03.20.10` → `82032010` |

**Fonte BAIFER:** primeira aba do `OK.xlsx`. **Fonte Loja:** aba `LOJA` do ODS. A aba `Planilha_Classes_Fiscais` não é extraída, seedada nem testada.

## Testes

- `pytest` — contagens e matriz `32141010` na planilha
- `npm test` — motor TS, auth/tenant, import fixture, escape de PDF

## Documentação

- [Para o dono](docs/PARA-O-DONO.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Banco](docs/DATABASE.md)
- [Segurança](docs/SECURITY.md)
- [Deploy](docs/DEPLOY.md)
- [Changelog](docs/CHANGELOG.md)

# Fixtures de calibração NCM

| Arquivo | Uso |
|---|---|
| `ncm-atualizado.ods` | Planilha padrão: cadastro Santri + regras BAIFER + regras LOJA |
| `tributacao-ncm-baifer-2026-08-07.xlsx` | Regras BAIFER (aba `Planilha1`, cabeçalho na linha 1) |
| `tributacao-ncm-lojao-2026-06-28.xlsx` | Regras Loja / Lojão (aba `Planilha1`; CFOP `5,405`) |
| `planilha-regra-fiscal-unica.xlsx` | Regras Unica canônicas (aba `NCM ATUALIZADO `; MVA/alíquota DF·GO·MG) |
| `tributacao-ncm-unica-atacadista-2026-08-27.xlsx` | Mesmas regras Unica + coluna `ABREVIACAO` (aba `Planilha3`) |
| `cadastro-teste.csv` | Cadastro mínimo para testes de import |

Registro: `data/calibracao/layouts.json`.

## Como usar

1. Ao calibrar layout novo, copie a planilha para esta pasta.
2. Atualize `layouts.json`.
3. Rode `npm test` e `pytest` em `NCM/fiscal`.

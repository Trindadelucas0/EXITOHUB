# Fixtures de calibração NCM

| Arquivo | Uso |
|---|---|
| `ncm-atualizado.ods` | Planilha padrão: cadastro Santri + regras BAIFER + regras LOJA |
| `tributacao-ncm-baifer-2026-08-07.xlsx` | Regras BAIFER (aba `Planilha1`, cabeçalho na linha 1) |
| `tributacao-ncm-lojao-2026-06-28.xlsx` | Regras Loja / Lojão (aba `Planilha1`; CFOP `5,405`) |
| `planilha-regra-fiscal-unica.xlsx` | Regras Unica sem coluna `ABREVIACAO` (aba `NCM ATUALIZADO `); import completa Abrev. pelo NCM Atacadista |
| `tributacao-ncm-unica-atacadista-2026-08-27.xlsx` | Mesmas regras Unica + coluna `ABREVIACAO` (aba `Planilha3`) |
| `cadastro-teste.csv` | Cadastro mínimo para testes de import |
| `cadastro-egaplast-ncm-2026-08-27.xls` | Listagem Egaplast (aba `Dados`: CÓDIGO, NOME, ORIGEM, NCM). Com `companyName` Egaplast entra na extração da **base fiscal** |
| `cadastro-egaplast-relatorio-produtos.xlsx` | Relatório Egaplast em blocos (SIT.TRIBUTÁRIA + IVA/ICM por UF). Com `companyName` Egaplast vira regra CST+IVA |
| `tributacao-ncm-egaplast-2026-08-31.xlsx` | Tributação NCM Egaplast (NCM, CEST, segmento, MVA/alíquota por UF). Com `companyName` Egaplast vira base `TRIBUTACAO_UF` |
| `regra-tributaria-x-produtos-egaplast.xlsx` | Cadastro do cliente Egaplast. A aba larga (CÓDIGO + DESCRIÇÃO + NCM + SIT + UFs) é o lote, qualquer nome. Relatório `IVA/ICM:` só completa IVA vazio. Aba de divergência é ignorada. Ouro: `10100` e `10200` SP `1.9424` (divergem em DF e PR; MA, PI, SE e TO estão 0 no cadastro e não divergem); `10255` SIT `10` (diverge em AL, DF, PR). ~4182 SKUs. Importe em Planilhas. Não vira base fiscal |
| `ncm-regra-fiscal-exito-egaplast.xlsx` | Base fiscal CST+IVA EXITO Egaplast: cabeçalho NCM + ORIGEM + SIT + `UF SIGNATÁRIO` (sem CÓDIGO). Ouro `84818019` SP `1.9854` nacional / `2.1659` importado. Importe em Base fiscal. Não vira lote de Planilhas |

Registro: `data/calibracao/layouts.json`.

## Como usar

1. Ao calibrar layout novo, copie a planilha para esta pasta.
2. Atualize `layouts.json`.
3. Rode `npm test` e `pytest` em `NCM/fiscal`.

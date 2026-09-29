# Fixtures de calibração

Amostras reais usadas para calibrar o sistema (abril/2026, com Sicoob 07/2026 e Baifer 08/2026).

## Arquivos

| Arquivo | Tipo | Origem |
|---|---|---|
| `extrato-itau-baifer-04-2026.xlsx` | extrato | BAIFER Itaú |
| `extrato-itau-baifer-08-2026.xlsx` | extrato | BAIFER Itaú 08/2026 (mesmo layout de 04/2026) |
| `extrato-stone-baifer-04-2026.xls` | extrato | BAIFER Stone |
| `contas-pagar-baifer-04-2026.ods` | contasPagar | BAIFER |
| `contas-pagar-baifer-08-2026.ods` | contasPagar | BAIFER 08/2026 (mesmo layout de 04/2026) |
| `extrato-mercado-pago-lojao-04-2026.xlsx` | extrato | Lojão Mercado Pago |
| `extrato-bb-lojao-04-2026.xlsx` | extrato | Lojão Banco do Brasil (`Inf.` C/D) |
| `extrato-sicoob-07-2026.xlsx` | extrato | Sicoob 07/2026 (Documento não é CNPJ) |
| `contas-pagar-lojao-04-2026.ods` | contasPagar | Lojão |

Registro: `data/calibracao/layouts.json`.

## Como usar

1. Ao calibrar layout novo, copie a planilha para esta pasta.
2. Atualize `layouts.json`.
3. Teste em `tests/` + `npm test`.

Testes que abrem estas amostras pelo nome precisam fixar o mês (ex.: `04-2026`), senão outra competência do mesmo banco pode ser escolhida.

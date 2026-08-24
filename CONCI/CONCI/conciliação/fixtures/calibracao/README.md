# Fixtures de calibração

Amostras reais usadas para calibrar o sistema (abril/2026).

## Arquivos

| Arquivo | Tipo | Origem |
|---|---|---|
| `extrato-itau-baifer-04-2026.xlsx` | extrato | BAIFER Itaú |
| `extrato-stone-baifer-04-2026.xls` | extrato | BAIFER Stone |
| `contas-pagar-baifer-04-2026.ods` | contasPagar | BAIFER |
| `extrato-mercado-pago-lojao-04-2026.xlsx` | extrato | Lojão Mercado Pago |
| `extrato-bb-lojao-04-2026.xlsx` | extrato | Lojão Banco do Brasil (`Inf.` C/D) |
| `contas-pagar-lojao-04-2026.ods` | contasPagar | Lojão |

Registro: `data/calibracao/layouts.json`.

## Como usar

1. Ao calibrar layout novo, copie a planilha para esta pasta.
2. Atualize `layouts.json`.
3. Teste em `tests/` + `npm test`.

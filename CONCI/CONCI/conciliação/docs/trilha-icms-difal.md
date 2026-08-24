# Trilha do ICMS Diferencial de Alíquotas

Imagem (paisagem): [trilha-icms-difal-paisagem.png](./trilha-icms-difal-paisagem.png)

## Mermaid

```mermaid
flowchart LR
  startNode["Início: Venda da Mercadoria"] --> d1{"Comprador está em outro Estado?"}
  d1 -->|Sim| d2{"Mercadoria será consumida?"}
  d1 -->|Não| noDifal["Não tem DIFAL"]
  d2 -->|Não| noDifal
  d2 -->|Sim| temDifal["Tem DIFAL. Agora vamos ver quem recolhe?"]
  temDifal --> d3{"Destinatário é contribuinte do ICMS?"}
  d3 -->|Não| remetente["Remetente é responsável"]
  d3 -->|Sim| d4{"Produto tem acordo ST com o destino?"}
  d4 -->|Sim| remetente
  d4 -->|Não| destinatario["Destinatário é responsável"]
```

## Notas GNRE

- Destinatário **não** contribuinte → campo NF-e **ICMS UF Destino** | GNRE `100102` (não inscrito) / `100110` (inscrito)
- Destinatário contribuinte **com** acordo ST → campo NF-e **ICMS ST** | GNRE `100099` (não inscrito) / `100048` (inscrito)

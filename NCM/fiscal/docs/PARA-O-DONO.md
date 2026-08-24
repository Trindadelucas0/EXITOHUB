# Visão para o proprietário

O Auditor Fiscal BAIFER é um sistema interno do escritório. Ele **não substitui o ERP**. Serve para conferir se o cadastro de produtos (quando importado) está alinhado com a tributação combinada na planilha de NCMs da BAIFER.

## O que o sistema faz hoje

- Guarda a **base fiscal da empresa ativa**:
  - BAIFER ← primeira aba do `OK.xlsx`
  - Loja das Máquinas ← aba **LOJA** do ODS
  - As duas **não se misturam**
- Permite **importar** várias planilhas; cada arquivo vira um lote no histórico, sem misturar. Em Panorama, Consulta e Divergências dá para **escolher a planilha** e ver só os dados dela.
- Classifica cada produto como **correto**, **divergente** ou **necessita análise**.
- Em **Divergências**, mostra primeiro **quantos NCMs** estão errados; um clique filtra a grade.
- Compara a planilha nova com a **anterior** (códigos novos, que saíram, NCM ou situação que mudou).
- Permite marcar produto ou NCM como **já tratado**. Na próxima importação dá para **trazer essas marcas** (ou começar do zero).
- Mostra a **matriz dos 8 destinatários** (não um CST único).
- Exporta **PDF e Excel** no formato da planilha: grade completa, detalhe do que está errado, e Excel separado por regra NCM.
- Orienta **como dar entrada** só com o que existe na regra — sem inventar CFOP de entrada, CEST ou PIS/COFINS.

## O que ele não faz (ainda)

- Não conversa direto com o ERP Santri.
- Não calcula ICMS-ST, DIFAL ou DARE.
- Não é um aplicativo de celular (o site funciona no telefone, mas não há app nas lojas).

## Quem acessa

A tela inicial é só login. Cada e-mail abre o painel daquela conta:

- **Administrador do escritório:** vê as empresas, cadastra empresa e usuários de qualquer empresa. Clicando em “Entrar” abre a conferência daquela empresa, com um aviso no topo e o botão “Voltar ao escritório”.
- **Administrador da empresa** (BAIFER, Loja, etc.): importa cadastro e vincula regra quando o NCM tem duas hipóteses. Não cadastra empresa nem usuário — isso é do escritório.
- **Consulta:** lê, busca, exporta Excel/PDF e marca item/NCM como já tratado.

## Como os dados são protegidos

- A senha não fica guardada em texto; fica um hash.
- A sessão fica em cookie HttpOnly (não no armazenamento do navegador).
- Cada consulta de produto/regra exige a empresa da sessão. Outra empresa não vê os dados da BAIFER.
- A senha do banco e a senha do admin ficam só no arquivo `.env` da máquina/servidor, não no código.

## Como começar no dia a dia

1. Entrar no sistema.
2. Conferir a **Base fiscal** (já vem preenchida após a instalação).
3. **Importar** o cadastro atual da BAIFER (export Santri *Relação de Classes Fiscais*, arquivo `bs.xlsx`). Isso **não** é a base fiscal — é o cadastro a ser auditado. Cada arquivo fica no histórico; use **Ver conferência** ou o seletor **Ver dados desta planilha** para olhar só aquele arquivo.
4. Abrir **Divergências**, filtrar pelo NCM e marcar o que já foi ajustado no ERP.
5. Em NCM com ST e REDUÇÃO, o administrador **vincula** a regra correta.

## Expansão

A arquitetura (tela → API → banco) permite, no futuro, um aplicativo mobile ou desktop usando a mesma API, sem refazer as regras fiscais.

import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/src/components/ui/page-header";

const SECTIONS = [
  { id: "o-que-faz", title: "O que este sistema faz" },
  { id: "comecar", title: "Por onde começar" },
  { id: "consultar", title: "Consultar um produto" },
  { id: "divergencias", title: "Trabalhar as divergências" },
  { id: "tratado", title: "Marcar como já tratado" },
  { id: "ncm", title: "NCM: o que edita e o que não edita" },
  { id: "entrada", title: "Como dar entrada na nota" },
  { id: "base-fiscal", title: "Base fiscal" },
  { id: "importar", title: "Importar planilha" },
  { id: "exportar", title: "Exportar Excel ou PDF" },
  { id: "permissoes", title: "Quem pode o quê" },
] as const;

export function UserManual() {
  return (
    <div className="mx-auto grid max-w-3xl gap-10">
      <PageHeader
        kicker="Guia do analista"
        title="Como usar o Auditor Fiscal"
        description="Este guia explica o dia a dia da conferência: o que o sistema compara, o que muda quando você marca tratado, e o que dá para editar no NCM."
      />

      <nav aria-label="Assuntos deste guia" className="rounded-lg border border-line bg-white p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">Ir para</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {SECTIONS.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="text-sm text-brand underline-offset-2 hover:underline">
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <article className="grid gap-10">
        <ManualCard id="o-que-faz" title="O que este sistema faz">
          <p>
            O Auditor Fiscal confere o cadastro de produtos da empresa com a regra fiscal daquela
            empresa. Ele não substitui o sistema do cliente (ERP). Aqui você vê o que está certo e o
            que precisa ser corrigido lá.
          </p>
          <p>
            A conferência usa duas fontes. A <strong>planilha importada</strong> traz o cadastro
            (código, descrição, NCM e CSTs). A <strong>base fiscal</strong> traz a regra por NCM:
            como aquele código deve tributar.
          </p>
          <TermList
            items={[
              {
                term: "NCM",
                meaning: "código da mercadoria na tabela oficial. A regra fiscal é por NCM, não por produto.",
              },
              {
                term: "CST",
                meaning: "código da situação tributária (compra, venda e por tipo de destinatário).",
              },
              {
                term: "MVA (IVA)",
                meaning: "percentual usado em substituição tributária, quando a regra pede.",
              },
              {
                term: "CFOP",
                meaning: "código fiscal da operação (entrada ou saída).",
              },
            ]}
          />
          <p>O sistema classifica cada item em:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Correto</strong> — o cadastro bate com a regra.
            </li>
            <li>
              <strong>Divergente</strong> — NCM, CST, MVA ou destinos não batem, ou o NCM não está na
              base.
            </li>
            <li>
              <strong>Necessita análise</strong> — em geral o NCM tem mais de uma regra e alguém precisa
              escolher a hipótese.
            </li>
          </ul>
          <ScreenLink href="/dashboard">Abrir o Panorama</ScreenLink>
        </ManualCard>

        <ManualCard id="comecar" title="Por onde começar">
          <p>
            No canto superior você vê a empresa em que está trabalhando. Os dados de uma empresa não
            se misturam com os de outra.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Abra o Panorama.</li>
            <li>Escolha a planilha (lote) que quer conferir. Cada importação vira um lote separado.</li>
            <li>
              Olhe os quatro números: quantos itens foram analisados, quantos estão corretos,
              divergentes ou precisam de análise.
            </li>
            <li>
              Se houver lote anterior, o painel “O que mudou” mostra códigos novos, que saíram, com
              NCM diferente ou com situação diferente.
            </li>
          </ol>
          <p>Clique em um número para ir direto à lista filtrada.</p>
          <ScreenLink href="/dashboard">Ir para o Panorama</ScreenLink>
        </ManualCard>

        <ManualCard id="consultar" title="Consultar um produto">
          <p>
            Em Consultar você vê a planilha escolhida, linha a linha. Filtre por código, descrição,
            NCM ou situação.
          </p>
          <p>
            Clique na linha para abrir a ficha. Lá aparece o cadastro importado ao lado do que a
            regra manda. A tributação correta não vem do cadastro: vem da regra daquele NCM.
          </p>
          <p>
            Se o NCM tiver duas regras, a ficha pede para vincular a hipótese. Só o administrador
            consegue vincular.
          </p>
          <ScreenLink href="/consulta">Abrir Consultar</ScreenLink>
        </ManualCard>

        <ManualCard id="divergencias" title="Trabalhar as divergências">
          <p>
            Divergências mostra só o que não bateu. Itens já tratados ficam ocultos por padrão, para
            você trabalhar a fila.
          </p>
          <p>
            Clique na linha para expandir: o que veio errado no importado e como deve ficar. No topo
            há um resumo por NCM. Clique em um NCM para filtrar a fila só daquele código.
          </p>
          <p>
            Quando a regra daquele NCM estiver certa para todos os itens da fila, dá para marcar o
            NCM inteiro como já tratado, de uma vez.
          </p>
          <ScreenLink href="/divergencias">Abrir Divergências</ScreenLink>
        </ManualCard>

        <ManualCard id="tratado" title="Marcar como já tratado" highlight>
          <p>
            Use “já tratado” quando conferiu o item (ou o NCM) e quer alinhar o cadastro desta
            planilha com a regra fiscal.
          </p>
          <p className="font-medium text-ink">O que o sistema faz na hora:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Copia da regra para o produto: CST de compra, CST de saída, CST por destinatário e MVA.</li>
            <li>Recalcula a situação. Em geral o item passa a correto.</li>
            <li>A linha ganha a marca tratado.</li>
            <li>Os números do Panorama (corretos, divergentes, análise) são atualizados.</li>
          </ul>
          <p className="font-medium text-ink">O que não muda:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>o NCM do produto;</li>
            <li>a regra na Base fiscal;</li>
            <li>o cadastro no ERP do cliente.</li>
          </ul>
          <p>
            Você marca um produto na ficha, ou um NCM inteiro em Divergências. Dá para desmarcar se
            marcou por engano.
          </p>
          <p>
            Na próxima importação, o administrador pode pedir para trazer a marca do lote anterior
            (mesmo código). Se a situação fiscal mudou, aparece <strong>tratado*</strong> —
            desatualizado. Confira de novo ou desmarque.
          </p>
        </ManualCard>

        <ManualCard id="ncm" title="NCM: o que edita e o que não edita" highlight>
          <p>
            O NCM do produto e o NCM da regra são coisas diferentes. Misturar os dois é o erro mais
            comum.
          </p>
          <p>
            <strong>NCM do produto:</strong> não se edita nesta tela. Ele vem da planilha importada.
            Se estiver errado, corrige no ERP ou na planilha e importa de novo. No Panorama, “NCM
            mudou” compara o lote atual com o anterior.
          </p>
          <p>
            <strong>NCM da regra:</strong> o administrador edita em Base fiscal. Isso muda o “como
            deve ficar” para os produtos daquele NCM. Não reescreve o NCM gravado no cadastro
            importado.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <caption className="sr-only">Onde cada alteração aparece</caption>
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                  <th className="py-2 pr-3 font-medium">O que você faz</th>
                  <th className="py-2 pr-3 font-medium">Onde muda</th>
                  <th className="py-2 font-medium">Onde não muda</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="py-3 pr-3 align-top">Marca tratado</td>
                  <td className="py-3 pr-3 align-top">
                    CST, MVA e destinos deste produto neste lote; status na Consulta, Divergências e
                    Panorama
                  </td>
                  <td className="py-3 align-top">NCM; ERP; Base fiscal</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="py-3 pr-3 align-top">Edita a regra (NCM, CST, MVA…)</td>
                  <td className="py-3 pr-3 align-top">Base fiscal; o “como deve ficar” na ficha</td>
                  <td className="py-3 align-top">NCM do produto importado; ERP</td>
                </tr>
                <tr>
                  <td className="py-3 pr-3 align-top">Importa planilha com NCM diferente</td>
                  <td className="py-3 pr-3 align-top">
                    Cadastro do produto no lote novo; painel “NCM mudou”
                  </td>
                  <td className="py-3 align-top">Base fiscal (as regras continuam)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Editar uma regra não reprocessa sozinha a lista inteira. A ficha já compara na hora. A
            listagem guarda o status até você tratar de novo ou importar outro lote.
          </p>
          <ScreenLink href="/base-fiscal">Abrir Base fiscal</ScreenLink>
        </ManualCard>

        <ManualCard id="entrada" title="Como dar entrada na nota">
          <p>
            Na ficha do produto há o botão “Como dar entrada”. Use na hora de conferir a nota do
            fornecedor.
          </p>
          <p>
            A tela mostra NCM do cadastro, NCM da regra, CST da nota de entrada, CST da empresa,
            CFOP, MVA e um checklist. Se o cadastro ainda divergir, o alerta aparece no topo.
          </p>
        </ManualCard>

        <ManualCard id="base-fiscal" title="Base fiscal">
          <p>
            Aqui ficam as regras da empresa: um NCM, uma regra (às vezes duas hipóteses), para todos
            os produtos daquele NCM. Produtos da planilha não entram nesta tela.
          </p>
          <p>
            O administrador cadastra, edita, exclui regra a regra, importa a planilha ou exclui a
            base fiscal inteira (todas as regras da empresa). Os lotes de produtos continuam. O
            perfil consulta só lê.
          </p>
          <ScreenLink href="/base-fiscal">Abrir Base fiscal</ScreenLink>
        </ManualCard>

        <ManualCard id="importar" title="Importar planilha">
          <p>Só o administrador importa o cadastro de produtos. Cada arquivo vira um lote novo. A base fiscal não é apagada.</p>
          <p>
            Colunas reconhecidas: código, descrição, NCM, CST por destinatário, CST de compra,
            alíquota, IVA/MVA e CEST.
          </p>
          <p>
            Se já existir lote anterior, dá para trazer a marca “já tratado” dos mesmos códigos. Itens
            que já vierem corretos não copiam a marca.
          </p>
          <ScreenLink href="/importar">Abrir Importar produtos</ScreenLink>
        </ManualCard>

        <ManualCard id="exportar" title="Exportar Excel ou PDF">
          <p>
            Em Divergências, exporte o relatório para o cliente corrigir o ERP. O arquivo mostra o
            importado ao lado da regra, agrupado por NCM.
          </p>
          <p>
            Antes de gerar, escolha o que entra no arquivo: todos, só divergentes, só análise ou só
            corretos. A planilha ativa e “ocultar tratados” também entram na exportação. Marcar
            tratado aqui não altera o sistema do cliente: o Excel/PDF é o recado para eles
            ajustarem.
          </p>
          <ScreenLink href="/divergencias">Abrir Divergências para exportar</ScreenLink>
        </ManualCard>

        <ManualCard id="permissoes" title="Quem pode o quê">
          <p>
            <strong>Consulta</strong> (analista): vê Panorama, Consultar, Divergências, Base fiscal e
            este guia; marca e desmarca tratado; exporta Excel e PDF.
          </p>
          <p>
            <strong>Administrador</strong>: tudo acima, mais importar e apagar lotes, cadastrar,
            editar e excluir regras (incluindo a base fiscal inteira), vincular hipótese quando o
            NCM tem duas regras, empresas e usuários.
          </p>
        </ManualCard>
      </article>
    </div>
  );
}

function ManualCard({
  id,
  title,
  highlight = false,
  children,
}: {
  id: string;
  title: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 rounded-lg border bg-white p-5 sm:p-8 ${
        highlight ? "border-brand/40" : "border-line"
      }`}
    >
      <h2 className="font-display text-xl text-ink sm:text-2xl">{title}</h2>
      <div className="mt-4 grid gap-4 text-sm leading-relaxed text-ink">{children}</div>
    </section>
  );
}

function ScreenLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <p>
      <Link href={href} className="text-sm font-medium text-brand underline-offset-2 hover:underline">
        {children}
      </Link>
    </p>
  );
}

function TermList({ items }: { items: { term: string; meaning: string }[] }) {
  return (
    <dl className="grid gap-3 rounded-md bg-paper-sunken px-4 py-3">
      {items.map((item) => (
        <div key={item.term}>
          <dt className="font-medium text-ink">{item.term}</dt>
          <dd className="text-ink-muted">{item.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

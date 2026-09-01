import { ncmCapituloLabel } from "@/src/lib/ncm-capitulo";
import { classifyOrigemIva } from "@/src/lib/origem-iva";
import {
  EGAPLAST_IVA_UF_KEYS,
  asIvaPorUf,
  parseIvaFactor,
  type IvaPorUf,
} from "@/src/lib/iva-por-uf";
import type { ParsedProduct } from "./import-cadastro";
import { emptyDestinos } from "./rule-classify";
import type { ParsedRule } from "./import-rules";
import { normalizeCst } from "./ncm";

export function situacaoFromEgaplastCst(cst: string | null): {
  situacaoCodigo: ParsedRule["situacaoCodigo"];
  situacao: string;
} {
  const folded = normalizeCst(cst);
  if (folded === "10") return { situacaoCodigo: "ST_INTERNO", situacao: "ST interno" };
  if (folded === "51") return { situacaoCodigo: "REDUCAO", situacao: "Redução" };
  if (folded === "0") return { situacaoCodigo: "REGRA_GERAL", situacao: "Regra geral" };
  return { situacaoCodigo: "INCOMPLETA", situacao: "Incompleta" };
}

export function joinEgaplastCadastro(
  dados: ParsedProduct[],
  relatorio: ParsedProduct[],
): ParsedProduct[] {
  const byCodigo = new Map<string, ParsedProduct>();
  for (const row of relatorio) {
    if (!byCodigo.has(row.codigo)) byCodigo.set(row.codigo, row);
  }
  return dados.map((row) => {
    const extra = byCodigo.get(row.codigo);
    if (!extra) return row;
    return {
      ...row,
      ncm: row.ncm || extra.ncm,
      ncmOriginal: row.ncmOriginal || extra.ncmOriginal,
      cstUnico: extra.cstUnico,
      ivaMva: extra.ivaMva,
      ivaMvaNumero: extra.ivaMvaNumero,
      origem: row.origem || extra.origem,
      ivaPorUf: extra.ivaPorUf ?? row.ivaPorUf,
    };
  });
}

function majorityIvaPorUf(rows: ParsedProduct[]): IvaPorUf | null {
  const out: IvaPorUf = {};
  let filled = 0;
  for (const uf of EGAPLAST_IVA_UF_KEYS) {
    const counts = new Map<string, { n: number; text: string }>();
    for (const row of rows) {
      const text = row.ivaPorUf?.[uf];
      if (text == null || String(text).trim() === "") continue;
      const key = String(parseIvaFactor(text) ?? text);
      const current = counts.get(key) ?? { n: 0, text: String(text) };
      current.n += 1;
      counts.set(key, current);
    }
    const ranked = [...counts.values()].sort((a, b) => b.n - a.n);
    if (ranked[0]) {
      out[uf] = ranked[0].text;
      filled += 1;
    }
  }
  return filled > 0 ? asIvaPorUf(out) : null;
}

function majorityIva(rows: ParsedProduct[]): {
  ivaMva: string | null;
  ivaMvaNumero: number | null;
} {
  const counts = new Map<string, { n: number; ivaMva: string | null; ivaMvaNumero: number | null }>();
  for (const row of rows) {
    const key = row.ivaMvaNumero != null ? String(row.ivaMvaNumero) : "";
    const current = counts.get(key) ?? { n: 0, ivaMva: row.ivaMva, ivaMvaNumero: row.ivaMvaNumero };
    current.n += 1;
    counts.set(key, current);
  }
  const ranked = [...counts.values()].sort((a, b) => b.n - a.n);
  const picked = ranked[0];
  if (!picked || picked.ivaMvaNumero == null) return { ivaMva: null, ivaMvaNumero: null };
  return { ivaMva: picked.ivaMva, ivaMvaNumero: picked.ivaMvaNumero };
}

function buildEgaplastRule(input: {
  ncm: string;
  ncmOriginal: string;
  cstSaida: string | null;
  ivaMva: string | null;
  ivaMvaNumero: number | null;
  ivaPorUf: IvaPorUf | null;
  ivaPorUfImportado: IvaPorUf | null;
  situacaoCodigo: ParsedRule["situacaoCodigo"];
  situacao: string;
}): ParsedRule {
  return {
    ncm: input.ncm,
    ncmOriginal: input.ncmOriginal,
    segmento: ncmCapituloLabel(input.ncm),
    cstEntrada: null,
    cstSaida: input.cstSaida,
    cfopSaida: null,
    destinosCst: emptyDestinos(),
    situacao: input.situacao,
    situacaoCodigo: input.situacaoCodigo,
    mvaPercentual: input.ivaMvaNumero,
    mvaTexto: input.ivaMva,
    mvaKind: input.ivaMvaNumero != null ? "numeric" : "skip",
    cest: null,
    ipi: null,
    abreviacao: undefined,
    reducao: input.situacaoCodigo === "REDUCAO",
    reducaoPercentual: null,
    ufTributacao: null,
    ivaPorUf: input.ivaPorUf,
    ivaPorUfImportado: input.ivaPorUfImportado,
  };
}

/** Planilha1 → regras completas; Dados → NCMs ainda sem tributação (INCOMPLETA). */
export function rulesFromEgaplastCadastro(
  relatorio: ParsedProduct[],
  dados: ParsedProduct[],
): ParsedRule[] {
  const byKey = new Map<string, ParsedProduct[]>();
  for (const row of relatorio) {
    if (row.ncm.length !== 8) continue;
    const sit = situacaoFromEgaplastCst(row.cstUnico);
    const key = `${row.ncm}::${sit.situacaoCodigo}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }
  const rules: ParsedRule[] = [];
  const taxedNcms = new Set<string>();
  for (const [, rows] of byKey) {
    const first = rows[0];
    if (!first) continue;
    const sit = situacaoFromEgaplastCst(first.cstUnico);
    const nacionalRows = rows.filter((row) => classifyOrigemIva(row.origem) === "nacional");
    const importadoRows = rows.filter((row) => classifyOrigemIva(row.origem) === "importado");
    const ivaNacional = majorityIva(nacionalRows.length > 0 ? nacionalRows : rows);
    taxedNcms.add(first.ncm);
    rules.push(
      buildEgaplastRule({
        ncm: first.ncm,
        ncmOriginal: first.ncmOriginal || first.ncm,
        cstSaida: first.cstUnico,
        ivaMva: ivaNacional.ivaMva,
        ivaMvaNumero: ivaNacional.ivaMvaNumero,
        ivaPorUf: majorityIvaPorUf(nacionalRows.length > 0 ? nacionalRows : rows),
        ivaPorUfImportado: majorityIvaPorUf(importadoRows),
        situacaoCodigo: sit.situacaoCodigo,
        situacao: sit.situacao,
      }),
    );
  }
  const seenIncomplete = new Set<string>();
  for (const row of dados) {
    if (row.ncm.length !== 8) continue;
    if (taxedNcms.has(row.ncm) || seenIncomplete.has(row.ncm)) continue;
    seenIncomplete.add(row.ncm);
    rules.push(
      buildEgaplastRule({
        ncm: row.ncm,
        ncmOriginal: row.ncmOriginal || row.ncm,
        cstSaida: null,
        ivaMva: null,
        ivaMvaNumero: null,
        ivaPorUf: null,
        ivaPorUfImportado: null,
        situacaoCodigo: "INCOMPLETA",
        situacao: "Incompleta",
      }),
    );
  }
  return rules;
}

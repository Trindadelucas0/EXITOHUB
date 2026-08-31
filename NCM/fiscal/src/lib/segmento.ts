export const SEGMENTO_FORA = "__fora__";
export const SEGMENTO_VAZIO = "__vazio__";
export const SEGMENTO_MAX_LEN = 200;

export function foldSegmento(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export function parseSegmentoParam(raw: string | null | undefined): string {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  return text.length > SEGMENTO_MAX_LEN ? text.slice(0, SEGMENTO_MAX_LEN) : text;
}

export function segmentoIdFromRule(segmento: string | null | undefined): string {
  return foldSegmento(segmento) ? foldSegmento(segmento) : SEGMENTO_VAZIO;
}

export function segmentoLabel(id: string, canonical?: string): string {
  if (id === SEGMENTO_FORA) return "Fora da base";
  if (id === SEGMENTO_VAZIO) return "Sem segmento";
  const named = canonical?.trim();
  return named || id;
}

export function canonicalSegmentoName(names: string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"),
  );
  return ranked[0]?.[0] ?? "";
}

export function ncmFilterForSegmento(
  rules: { ncm: string; segmento: string }[],
  filter: string,
): { mode: "in" | "notIn"; ncms: string[] } {
  const unique = new Map<string, string>();
  for (const rule of rules) {
    if (!unique.has(rule.ncm)) unique.set(rule.ncm, rule.segmento);
  }
  const allNcms = [...unique.keys()];
  if (filter === SEGMENTO_FORA) return { mode: "notIn", ncms: allNcms };
  const wanted = filter === SEGMENTO_VAZIO ? SEGMENTO_VAZIO : foldSegmento(filter);
  const ncms = [...unique.entries()]
    .filter(([, segmento]) => segmentoIdFromRule(segmento) === wanted)
    .map(([ncm]) => ncm);
  return { mode: "in", ncms };
}

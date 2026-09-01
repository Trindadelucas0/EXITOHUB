/** Capítulo TIPI (2 primeiros dígitos do NCM) → nome usado como segmento Egaplast. */
const CAPITULOS: Record<string, string> = {
  "27": "Combustíveis minerais",
  "32": "Extratos tanantes e tintoriais",
  "34": "Sabões, agentes de superfície e ceras",
  "35": "Matérias albuminóides e colas",
  "37": "Produtos para fotografia e cinematografia",
  "38": "Produtos diversos das indústrias químicas",
  "39": "Plásticos e suas obras",
  "40": "Borracha e suas obras",
  "48": "Papel e cartão",
  "49": "Livros, jornais e artes gráficas",
  "56": "Pastas, feltros e artigos de matérias têxteis",
  "68": "Obras de pedra, gesso e cimento",
  "70": "Vidro e suas obras",
  "72": "Ferro fundido, ferro e aço",
  "73": "Obras de ferro fundido, ferro ou aço",
  "74": "Cobre e suas obras",
  "76": "Alumínio e suas obras",
  "82": "Ferramentas e cutelaria",
  "83": "Obras diversas de metais comuns",
  "84": "Máquinas e aparelhos mecânicos",
  "85": "Máquinas e aparelhos elétricos",
  "87": "Veículos automóveis",
  "90": "Instrumentos e aparelhos de óptica",
  "94": "Móveis e aparelhos de iluminação",
  "96": "Obras diversas",
};

export function ncmCapituloCodigo(ncm: string): string {
  const digits = String(ncm ?? "").replace(/\D/g, "");
  if (digits.length < 2) return "";
  return digits.slice(0, 2);
}

export function ncmCapituloLabel(ncm: string): string {
  const cap = ncmCapituloCodigo(ncm);
  if (!cap) return "";
  return CAPITULOS[cap] ?? `Capítulo ${cap}`;
}

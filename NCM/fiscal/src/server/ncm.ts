export function normalizeNcm(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length < 8) return digits.padStart(8, "0");
  return digits.slice(0, 8);
}

export function normalizeCst(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  return String(Number.parseInt(digits, 10));
}

export function parseMvaNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const folded = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (folded === "nao" || folded === "não") return null;
  if (folded.includes("#n/d") || folded.startsWith("sim")) return null;
  const cleaned = text.replace("%", "").replace(/\./g, "").replace(",", ".").trim();
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function mvaRequiresAnalysis(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const folded = String(raw)
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (!folded) return false;
  return folded.includes("#n/d") || folded.startsWith("sim");
}

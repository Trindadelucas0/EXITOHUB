export const ACTIVE_LOTE_EVENT = "fiscal-lote";
export const ACTIVE_LOTE_KEY = "fiscal_active_lote";

const LOTE_PAGES = new Set(["/dashboard", "/consulta", "/divergencias"]);

export function readActiveLote(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(ACTIVE_LOTE_KEY);
  } catch {
    return null;
  }
}

export function writeActiveLote(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) sessionStorage.setItem(ACTIVE_LOTE_KEY, id);
    else sessionStorage.removeItem(ACTIVE_LOTE_KEY);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(ACTIVE_LOTE_EVENT));
}

export function hrefWithLote(href: string, lote: string | null | undefined): string {
  if (!lote || !LOTE_PAGES.has(href)) return href;
  return `${href}?lote=${encodeURIComponent(lote)}`;
}

export function syncLoteInUrl(pathname: string, currentSearch: string, lote: string | null) {
  const params = new URLSearchParams(currentSearch);
  if (lote) params.set("lote", lote);
  else params.delete("lote");
  const qs = params.toString();
  const next = qs ? `${pathname}?${qs}` : pathname;
  const current = currentSearch ? `${pathname}?${currentSearch}` : pathname;
  writeActiveLote(lote);
  if (next === current || typeof window === "undefined") return;
  window.history.replaceState(window.history.state, "", next);
}

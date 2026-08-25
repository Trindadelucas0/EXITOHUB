/** Prefixo público do NCM quando montado no EXITO HUB. */
export function appBasePath(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_PATH) {
    return process.env.NEXT_PUBLIC_BASE_PATH;
  }
  if (typeof process !== "undefined" && process.env.HUB_MODE === "1") {
    return "/ncm";
  }
  return "";
}

export function withBasePath(path: string): string {
  const base = appBasePath();
  if (!path.startsWith("/")) return `${base}/${path}`;
  if (!base) return path;
  if (path === base || path.startsWith(`${base}/`)) return path;
  return `${base}${path}`;
}

/** Prefixa fetch do NCM no HUB, sem depender do patch global de window.fetch. */
export function ncmApiUrl(path: string): string {
  const raw = path.startsWith("/") ? path : `/${path}`;
  const fromWindow =
    typeof window !== "undefined" && window.location.pathname.startsWith("/ncm") ? "/ncm" : "";
  const prefix = fromWindow || appBasePath();
  if (prefix && (raw === prefix || raw.startsWith(`${prefix}/`))) return raw;
  return `${prefix}${raw}`;
}

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

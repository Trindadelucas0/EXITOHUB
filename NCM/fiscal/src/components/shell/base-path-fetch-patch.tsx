/**
 * Prefixa fetch("/") com basePath do Next quando o NCM roda sob /ncm no HUB.
 * Preferir o script síncrono no layout (antes do React). Este componente
 * só reforça o patch se o script ainda não tiver rodado.
 */
"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __NCM_FETCH_PATCHED__?: string;
  }
}

export function BasePathFetchPatch({ basePath }: { basePath: string }) {
  useEffect(() => {
    if (!basePath) return;
    if (window.__NCM_FETCH_PATCHED__ === basePath) return;
    const orig = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === "string" && input.startsWith("/") && !input.startsWith(basePath)) {
        if (
          input === "/login"
          || input.startsWith("/login?")
          || input === "/logout"
          || input.startsWith("/logout?")
          || input.startsWith("/hub-assets")
          || input.startsWith("/folha")
          || input.startsWith("/conci")
          || input.startsWith("/admin/usuarios")
        ) {
          return orig(input, init);
        }
        return orig(`${basePath}${input}`, init);
      }
      return orig(input, init);
    }) as typeof fetch;
    window.__NCM_FETCH_PATCHED__ = basePath;
  }, [basePath]);

  return null;
}

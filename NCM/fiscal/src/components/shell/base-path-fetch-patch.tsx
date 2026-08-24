"use client";

import { useEffect } from "react";

/**
 * Prefixa fetch("/") com basePath do Next quando o NCM roda sob /ncm no HUB.
 */
export function BasePathFetchPatch({ basePath }: { basePath: string }) {
  useEffect(() => {
    if (!basePath) return;
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
    return () => {
      window.fetch = orig;
    };
  }, [basePath]);

  return null;
}

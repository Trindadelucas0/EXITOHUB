import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { BasePathFetchPatch } from "@/src/components/shell/base-path-fetch-patch";
import { appBasePath } from "@/src/lib/base-path";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Auditor Fiscal BAIFER",
  description: "Comparação do cadastro de produtos com a base NCM da BAIFER.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/** Script síncrono: prefixa fetch antes do React hidratar (igual à Conciliação). */
function syncFetchPatchScript(basePath: string) {
  if (!basePath) return null;
  const bp = JSON.stringify(basePath);
  return (
    <Script
      id="ncm-fetch-basepath"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(){var bp=${bp};if(!bp||typeof window==="undefined")return;if(window.__NCM_FETCH_PATCHED__===bp)return;var orig=window.fetch.bind(window);window.fetch=function(input,init){if(typeof input==="string"&&input.charAt(0)==="/"&&input.indexOf(bp)!==0){if(input==="/login"||input.indexOf("/login?")===0||input==="/logout"||input.indexOf("/logout?")===0||input.indexOf("/hub-assets")===0||input.indexOf("/folha")===0||input.indexOf("/conci")===0||input.indexOf("/admin/usuarios")===0){return orig(input,init);}return orig(bp+input,init);}return orig(input,init);};window.__NCM_FETCH_PATCHED__=bp;})();`,
      }}
    />
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const basePath = appBasePath();
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} font-sans antialiased`}>
        {syncFetchPatchScript(basePath)}
        <BasePathFetchPatch basePath={basePath} />
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import { BasePathFetchPatch } from "@/src/components/shell/base-path-fetch-patch";
import { appBasePath } from "@/src/lib/base-path";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const display = Source_Serif_4({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Auditor Fiscal BAIFER",
  description: "Comparação do cadastro de produtos com a base NCM da BAIFER.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const basePath = appBasePath();
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} ${display.variable} font-sans antialiased`}>
        <BasePathFetchPatch basePath={basePath} />
        {children}
      </body>
    </html>
  );
}

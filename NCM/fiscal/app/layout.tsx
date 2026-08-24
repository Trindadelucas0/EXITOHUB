import type { Metadata, Viewport } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const basePath = appBasePath();
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} font-sans antialiased`}>
        <BasePathFetchPatch basePath={basePath} />
        {children}
      </body>
    </html>
  );
}

import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const hubMode = process.env.HUB_MODE === "1";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  basePath: hubMode ? "/ncm" : undefined,
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["xlsx", "exceljs", "pdfkit", "pg"],
  allowedDevOrigins: ["127.0.0.1", "192.168.15.11", "localhost"],
  async headers() {
    const connectSrc = isDev ? "'self' ws: wss:" : "'self'";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src ${connectSrc}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
